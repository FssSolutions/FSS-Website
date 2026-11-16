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

// ---- Photos: real dimensions + the small WebP copies made by tools/optimize_images.py ----
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString('ascii', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const t = b.toString('ascii', 12, 16);
    if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

function imageManifest() {
  const out = {};
  for (const dir of ['assets/images', 'assets/uploads']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    const files = fs.readdirSync(abs);
    const size = f => { try { return imageSize(path.join(abs, f)); } catch (e) { return null; } };
    for (const f of files) {
      if (!/\.(jpe?g|png|gif|webp)$/i.test(f) || /\.w\d+\.webp$/i.test(f)) continue;
      const base = f.replace(/\.[^.]+$/, '');
      const dims = size(f);
      const variants = files
        .filter(v => v.startsWith(base + '.w') && /\.w\d+\.webp$/i.test(v))
        .map(v => ({ w: (size(v) || {}).w, src: dir + '/' + v }))
        .filter(v => v.w)
        .sort((a, b) => a.w - b.w);
      out[dir + '/' + f] = { w: dims && dims.w, h: dims && dims.h, variants };
    }
  }
  return out;
}

// ---- Business details for Google and AI assistants (schema.org JSON-LD) ----
function structuredData(site, page) {
  const s = site.settings || {}, biz = site.business || {};
  const base = (s.siteUrl || '').replace(/\/$/, '');
  if (!base) return '';
  const abs = p => /^https?:/.test(p) ? p : base + '/' + String(p).replace(/^\//, '');
  const clean = o => JSON.parse(JSON.stringify(o)); // drops empty (undefined) fields
  const areas = (biz.areas || []).filter(Boolean);
  const services = (biz.services || []).filter(Boolean);
  const business = clean({
    '@type': 'HomeAndConstructionBusiness',
    '@id': base + '/#business',
    name: s.siteName,
    url: base + '/',
    description: biz.description || undefined,
    logo: s.logo ? abs(s.logo) : undefined,
    image: (biz.images && biz.images.length ? biz.images : [s.ogImage || s.logo]).filter(Boolean).map(abs),
    telephone: biz.phone || undefined,
    email: biz.email || undefined,
    address: biz.city ? { '@type': 'PostalAddress', addressLocality: biz.city, addressRegion: biz.region || undefined, addressCountry: biz.country || undefined } : undefined,
    areaServed: areas.length ? areas.map(n => ({ '@type': /island/i.test(n) ? 'Place' : 'City', name: n })) : undefined,
    sameAs: [s.facebook, s.instagram].filter(Boolean),
    knowsAbout: services.length ? services : undefined,
    hasOfferCatalog: services.length ? {
      '@type': 'OfferCatalog', name: (s.siteName || '') + ' services',
      itemListElement: services.map(n => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } }))
    } : undefined
  });
  const graph = [business];
  if (!page.slug) graph.push({ '@type': 'WebSite', '@id': base + '/#website', name: s.siteName, url: base + '/', publisher: { '@id': base + '/#business' } });
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

function pageTitle(site, page) {
  const s = site.settings || {};
  if (page.seoTitle) return page.seoTitle;
  return page.fullTitle ? page.title : page.title + (s.titleSuffix || '');
}

let IMAGES = null;
function pageHtml(site, page, depth) {
  const prefix = depth ? '../'.repeat(depth) : './';
  const ctx = { linkPrefix: prefix, assetPrefix: prefix, images: IMAGES || (IMAGES = imageManifest()) };
  const s = site.settings || {};
  const title = pageTitle(site, page);
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
  ${page.slug === '__404' ? '<meta name="robots" content="noindex">' : structuredData(site, page)}
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
  fs.writeFileSync(path.join(outDir, '_headers'), [
    // Keep Google to the real domain: hide the temporary *.pages.dev addresses.
    'https://:project.pages.dev/*', '  X-Robots-Tag: noindex',
    'https://:version.:project.pages.dev/*', '  X-Robots-Tag: noindex',
    '/editor/*', '  X-Robots-Tag: noindex', '  Cache-Control: no-store',
    '/js/editor.js', '  Cache-Control: no-cache',
    '/js/render.js', '  Cache-Control: no-cache',
    '/css/*', '  Cache-Control: no-cache',
    // Photos never change once uploaded (new photos get new names), so browsers can keep them.
    '/assets/*', '  Cache-Control: public, max-age=2592000', ''
  ].join('\n'));
  IMAGES = imageManifest();

  // Redirects for old or renamed page addresses (Cloudflare Pages "_redirects" file).
  // A redirect is skipped if a real page now lives at that address.
  const pageUrls = new Set((site.pages || []).map(p => R.pageUrl(p)));
  const redirectLines = [];
  for (const r of site.redirects || []) {
    const from = String(r.from || '').trim().replace(/\/+$/, '');
    const to = String(r.to || '').trim();
    if (!/^\/[^\s#?]+$/.test(from) || !/^(\/|https?:\/\/)\S*$/.test(to)) continue;
    if (pageUrls.has(from + '/')) continue;
    redirectLines.push(from + ' ' + to + ' 301', from + '/ ' + to + ' 301');
  }
  fs.writeFileSync(path.join(outDir, '_redirects'), Array.from(new Set(redirectLines)).join('\n') + '\n');

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
