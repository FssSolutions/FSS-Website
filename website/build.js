#!/usr/bin/env node
/*
 * Builds the static, publishable site into dist/ from content.json.
 * Every page is pre-rendered to plain HTML (good for SEO and fast loading),
 * so dist/ can be uploaded to any static host (Netlify, GitHub Pages, cPanel...).
 *
 *   node build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./js/render.js');

const ROOT = __dirname;
const esc = R.esc;

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function pageHtml(site, page, depth) {
  const prefix = depth ? '../'.repeat(depth) : './';
  const ctx = { linkPrefix: prefix, assetPrefix: prefix };
  const s = site.settings || {};
  const title = page.fullTitle ? page.title : page.title + (s.titleSuffix || '');
  const url = (s.siteUrl || '').replace(/\/$/, '') + R.pageUrl(page);
  const ogImage = page.ogImage || s.ogImage || s.logo;
  return `<!doctype html>
<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(page.description || '')}">
  ${s.siteUrl ? `<link rel="canonical" href="${esc(url)}">` : ''}
  <meta property="og:site_name" content="${esc(s.siteName || '')}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(page.description || '')}">
  <meta property="og:type" content="website">
  ${s.siteUrl ? `<meta property="og:url" content="${esc(url)}">` : ''}
  ${ogImage && s.siteUrl ? `<meta property="og:image" content="${esc((s.siteUrl || '').replace(/\/$/, '') + '/' + ogImage.replace(/^\//, ''))}">` : ''}
  <link rel="icon" href="${esc(prefix + (s.favicon || s.logo || '').replace(/^\//, ''))}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${esc(R.fontsUrl(site))}">
  <link rel="stylesheet" href="${prefix}css/site.css">
  <style>${R.themeCss(site)}</style>
</head>
<body>
  <div id="site-root">${R.renderPage(site, page, ctx)}</div>
  <script src="${prefix}js/site.js"></script>
</body>
</html>
`;
}

function build(site, outDir) {
  site = site || JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
  outDir = outDir || path.join(ROOT, 'dist');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  copyDir(path.join(ROOT, 'css'), path.join(outDir, 'css'));
  copyDir(path.join(ROOT, 'assets'), path.join(outDir, 'assets'));
  fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'js', 'site.js'), path.join(outDir, 'js', 'site.js'));

  // The editor, at /editor/ (it saves through functions/api/ on Cloudflare).
  fs.copyFileSync(path.join(ROOT, 'js', 'render.js'), path.join(outDir, 'js', 'render.js'));
  fs.copyFileSync(path.join(ROOT, 'js', 'editor.js'), path.join(outDir, 'js', 'editor.js'));
  fs.mkdirSync(path.join(outDir, 'editor'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'editor.html'), path.join(outDir, 'editor', 'index.html'));
  fs.writeFileSync(path.join(outDir, '_headers'),
    '/editor/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-store\n/js/editor.js\n  Cache-Control: no-cache\n/js/render.js\n  Cache-Control: no-cache\n/css/*\n  Cache-Control: no-cache\n');

  const urls = [];
  for (const page of site.pages || []) {
    const slug = String(page.slug || '').replace(/^\/+|\/+$/g, '');
    if (!/^[a-z0-9\-\/]*$/i.test(slug)) throw new Error('Invalid page address: ' + slug);
    const depth = slug ? slug.split('/').length : 0;
    const dir = path.join(outDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(site, page, depth));
    if (!page.hidden) urls.push(R.pageUrl(page));
  }

  // 404 page (served by most static hosts for unknown URLs) — uses root-relative links.
  const notFound = { slug: '__404', title: 'Page not found', sections: [] };
  let html404 = pageHtml(site, notFound, 0).replace('<main class="site-main"></main>',
    '<main class="site-main"><div class="not-found"><h1>Page not found</h1><p><a href="/">Back to home</a></p></div></main>');
  html404 = html404.replace(/(href|src)="\.\//g, '$1="/');
  fs.writeFileSync(path.join(outDir, '404.html'), html404);

  const base = ((site.settings || {}).siteUrl || '').replace(/\/$/, '');
  if (base) {
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(u => `  <url><loc>${esc(base + u)}</loc></url>`).join('\n') + '\n</urlset>\n');
    fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /editor/\nSitemap: ${base}/sitemap.xml\n`);
  }
  return { pages: (site.pages || []).length, outDir };
}

module.exports = { build };

if (require.main === module) {
  const r = build();
  console.log(`Built ${r.pages} pages into ${path.relative(process.cwd(), r.outDir) || '.'}`);
}
