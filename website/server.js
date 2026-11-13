#!/usr/bin/env node
/*
 * Local server for editing the FSS Solutions website.
 *
 *   node server.js          → http://localhost:8080          (live preview)
 *                             http://localhost:8080/editor   (drag & drop editor)
 *
 * Saving in the editor writes content.json (a backup of the previous version is
 * kept in .backups/) and rebuilds the publishable static site in dist/.
 * No npm install needed — only Node.js 16+.
 *
 * This server is meant to run on your own computer. It listens on localhost only,
 * unless you set HOST (e.g. HOST=0.0.0.0) — if you do, also set EDITOR_PASSWORD.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { build } = require('./build.js');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const PASSWORD = process.env.EDITOR_PASSWORD || '';
const CONTENT = path.join(ROOT, 'content.json');
const UPLOADS = path.join(ROOT, 'assets', 'uploads');
const MAX_UPLOAD = 25 * 1024 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function authorised(req) {
  if (!PASSWORD) return true;
  const given = String(req.headers['x-editor-password'] || '');
  const a = Buffer.from(given), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p === base || p.startsWith(base + path.sep) ? p : null;
}

function listImages() {
  const out = [];
  for (const dir of ['assets/images', 'assets/uploads']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (IMAGE_EXT.includes(path.extname(f).toLowerCase())) out.push(dir + '/' + f);
    }
  }
  return out;
}

async function api(req, res, url) {
  if (url.pathname === '/api/ping') return send(res, 200, { ok: true, passwordRequired: !!PASSWORD });
  if (!authorised(req)) return send(res, 401, { error: 'Wrong or missing editor password' });

  if (url.pathname === '/api/images' && req.method === 'GET') return send(res, 200, { images: listImages() });

  if (url.pathname === '/api/content' && req.method === 'POST') {
    let site;
    try { site = JSON.parse((await readBody(req, 10 * 1024 * 1024)).toString('utf8')); }
    catch (e) { return send(res, 400, { error: 'Invalid JSON' }); }
    if (!site || !Array.isArray(site.pages)) return send(res, 400, { error: 'Content must have a pages list' });
    // Keep a backup of the previous version
    const backups = path.join(ROOT, '.backups');
    fs.mkdirSync(backups, { recursive: true });
    if (fs.existsSync(CONTENT)) fs.copyFileSync(CONTENT, path.join(backups, 'content-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'));
    const old = fs.readdirSync(backups).sort();
    while (old.length > 50) fs.unlinkSync(path.join(backups, old.shift()));
    fs.writeFileSync(CONTENT, JSON.stringify(site, null, 2) + '\n');
    try { build(site); }
    catch (e) { return send(res, 500, { error: 'Saved, but the build failed: ' + e.message }); }
    return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }

  if (url.pathname === '/api/upload' && req.method === 'POST') {
    const original = String(url.searchParams.get('name') || 'image.jpg');
    const ext = path.extname(original).toLowerCase();
    if (!IMAGE_EXT.includes(ext)) return send(res, 400, { error: 'Only image files can be uploaded' });
    let data;
    try { data = await readBody(req, MAX_UPLOAD); } catch (e) { return send(res, 413, { error: 'Image is larger than 25 MB' }); }
    const base = path.basename(original, path.extname(original)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'image';
    fs.mkdirSync(UPLOADS, { recursive: true });
    let name = base + ext, i = 1;
    while (fs.existsSync(path.join(UPLOADS, name))) name = base + '-' + (++i) + ext;
    fs.writeFileSync(path.join(UPLOADS, name), data);
    return send(res, 200, { src: 'assets/uploads/' + name });
  }

  if (url.pathname === '/api/backups' && req.method === 'GET') {
    const dir = path.join(ROOT, '.backups');
    return send(res, 200, { backups: fs.existsSync(dir) ? fs.readdirSync(dir).sort().reverse() : [] });
  }

  send(res, 404, { error: 'Not found' });
}

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    return api(req, res, url).catch(e => send(res, 500, { error: e.message }));
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request', 'text/plain'); }
  if (pathname === '/editor' || pathname === '/editor/') return serveFile(res, path.join(ROOT, 'editor.html'));
  // Built site preview at /dist/...
  const file = safeJoin(ROOT, pathname);
  if (!file || /(^|[\\/])\.(?!well-known)/.test(path.relative(ROOT, file))) return send(res, 403, 'Forbidden', 'text/plain');
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) return serveFile(res, file);
    if (!err && st.isDirectory() && fs.existsSync(path.join(file, 'index.html')) && pathname.startsWith('/dist')) return serveFile(res, path.join(file, 'index.html'));
    if (!path.extname(pathname)) return serveFile(res, path.join(ROOT, 'index.html')); // page routes → dev shell
    send(res, 404, 'Not found', 'text/plain');
  });
});

server.listen(PORT, HOST, () => {
  const h = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`FSS Solutions website\n  Preview: http://${h}:${PORT}/\n  Editor:  http://${h}:${PORT}/editor`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !PASSWORD) console.warn('  WARNING: listening on the network without EDITOR_PASSWORD set.');
});
