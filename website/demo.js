#!/usr/bin/env node
/*
 * Builds a self-contained TEST COPY of the website + editor into dist-demo/,
 * for trying things out on a phone (e.g. published as a private Claude artifact).
 * It opens on the website; "✎ Edit" opens the editor; Publish only saves on
 * that device and shows the result. Nothing touches the real site.
 *
 *   node demo.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist-demo');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const inlineJs = code => code.replace(/<\/script/gi, '<\\/script');

const content = JSON.parse(read('content.json'));
const config = { demo: true, assetPrefix: '', maxImage: 1400, content };

let html = read('editor.html')
  .replace(/<title>[^<]*<\/title>/, '<title>FSS Solutions — Website &amp; Editor (test copy)</title>')
  .replace(/\s*<link rel="(icon|apple-touch-icon)"[^>]*>/g, '')
  .replace('<link rel="stylesheet" href="/css/site.css">', () => '<style>\n' + read('css/site.css') + '\n</style>')
  .replace('<link rel="stylesheet" href="/css/editor.css">', () => '<style>\n' + read('css/editor.css') + '\n</style>')
  .replace('<script src="/js/render.js"></script>', () => '<script>\n' + inlineJs(read('js/render.js')) + '\n</script>')
  .replace('<script src="/js/editor.js"></script>', () =>
    '<script>window.FSS_EDITOR_CONFIG = ' + JSON.stringify(config).replace(/</g, '\\u003c') + ';</script>\n' +
    '<script>\n' + inlineJs(read('js/editor.js')) + '\n</script>');
if (/href="\/(css|js)\//.test(html) || /src="\/js\//.test(html)) throw new Error('editor.html changed: update demo.js');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets', 'images'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'images'))) {
  fs.copyFileSync(path.join(ROOT, 'assets', 'images', f), path.join(OUT, 'assets', 'images', f));
}
console.log('Built test copy in dist-demo/ (' + Math.round(html.length / 1024) + ' KB page + images)');
