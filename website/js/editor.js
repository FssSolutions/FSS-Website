/*
 * FSS Solutions — drag & drop site editor.
 *
 * Edits content.json visually:
 *  - drag blocks/sections from the left panel onto the page (or click to add)
 *  - drag the ⠿ handles to reorder blocks and sections, across columns too
 *  - click any text on the page and type; select text for bold/italic/links
 *  - drop image files from your computer straight onto images, galleries or columns
 *  - fine-tune anything in the right-hand panel (colours, layout, links, pages, menu)
 *  - Save writes content.json and rebuilds the publishable site in dist/
 */
(function () {
  'use strict';
  var R = window.FSSRender;
  var DRAFT_KEY = 'fss-editor-draft-v1';

  var state = {
    site: null, pageId: null, sel: null, tab: 'selection',
    undo: [], redo: [], dirty: false, server: false, passwordRequired: false,
    mobile: false, preview: false, visitor: false, savedJson: '', mode: null,
    pending: {},   // new photos not yet published: path -> File
    blobUrls: {}   // path -> object URL so new photos show before they are published
  };
  var PW_KEY = 'fss-editor-pw';
  // Optional settings from the page (used by the phone test copy, see demo.js).
  var CFG = window.FSS_EDITOR_CONFIG || {};
  var DEMO = !!CFG.demo;
  var ASSET = CFG.assetPrefix != null ? CFG.assetPrefix : '/';
  var DEMO_PUBLISHED_KEY = 'fss-demo-published-v1';
  if (DEMO) DRAFT_KEY = 'fss-demo-draft-v1';
  var isPhone = function () { return window.matchMedia('(max-width: 820px)').matches; };

  // ---------------------------------------------------------------- helpers
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 9); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return R.esc(s); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(function (k) { append(el, k); });
    else el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function setPath(obj, path, val) {
    var keys = path.split('.'), last = keys.pop();
    var target = keys.reduce(function (o, k) { return o[k]; }, obj);
    target[last] = val;
  }
  function slugify(s) { return String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  var ICON_PATHS = {
    drag: '<circle cx="9" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    gear: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    external: '<path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
    text: '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    button: '<rect x="3" y="8" width="18" height="8" rx="4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    gallery: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    cards: '<rect x="3" y="4" width="8" height="10" rx="1"/><rect x="13" y="4" width="8" height="10" rx="1"/><path d="M3 18h8M13 18h8"/>',
    links: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    form: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="12" width="18" height="8" rx="1"/>',
    spacer: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    divider: '<path d="M3 12h18"/>',
    embed: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICON_PATHS[n] || '') + '</svg>'; }

  // ---------------------------------------------------------------- block & section library
  var BLOCKS = {
    heading: { label: 'Heading', make: function () { return { type: 'heading', level: 2, text: 'New heading' }; } },
    text: { label: 'Text', make: function () { return { type: 'text', html: '<p>Write something here. Select words to make them bold, italic or a link.</p>' }; } },
    list: { label: 'List', make: function () { return { type: 'list', items: ['First item', 'Second item', 'Third item'] }; } },
    button: { label: 'Button', make: function () { return { type: 'button', label: 'Request a Quote', href: '/contact/', variant: 'outline' }; } },
    image: { label: 'Image', make: function () { return { type: 'image', src: '', alt: '', ratio: 'auto' }; } },
    gallery: { label: 'Gallery', make: function () { return { type: 'gallery', columns: 3, images: [] }; } },
    cards: { label: 'Cards', make: function () { return { type: 'cards', columns: 3, items: [{ title: 'Project name', image: '', href: '' }, { title: 'Project name', image: '', href: '' }] }; } },
    links: { label: 'Links', make: function () { return { type: 'links', title: 'Links', items: [{ label: 'Contact', href: '/contact/' }] }; } },
    form: { label: 'Form', make: function () {
      return { type: 'form', email: (state.site && findEmail()) || '', subject: 'New enquiry from the website', action: '', submitLabel: 'Submit', successMessage: 'Thank you! We will be in touch shortly.',
        fields: [{ label: 'Name', name: 'name', type: 'text', required: true }, { label: 'Email', name: 'email', type: 'email', required: true }, { label: 'Message', name: 'message', type: 'textarea', required: true }] };
    } },
    spacer: { label: 'Spacer', make: function () { return { type: 'spacer', height: 40 }; } },
    divider: { label: 'Divider', make: function () { return { type: 'divider' }; } },
    embed: { label: 'Embed', make: function () { return { type: 'embed', html: '<!-- Paste a Google Map, YouTube or other embed code here -->' }; } }
  };
  function findEmail() { var m = JSON.stringify(state.site).match(/mailto:([^"?]+)/); return m ? m[1] : ''; }

  function S(style, layout, cols, extra) {
    return Object.assign({ layout: layout, style: style, columns: cols.map(function (b) { return { blocks: b }; }) }, extra || {});
  }
  var H = function (l, t, m) { return Object.assign({ type: 'heading', level: l, text: t }, m || {}); };
  var T = function (html, m) { return Object.assign({ type: 'text', html: html }, m || {}); };
  var BTN = function (l, href, m) { return Object.assign({ type: 'button', label: l, href: href, variant: 'outline' }, m || {}); };
  var IMG = function (src, m) { return Object.assign({ type: 'image', src: src, alt: '', ratio: '4:5' }, m || {}); };
  var LOREM = '<p>Describe this part of your business. Click here to edit the text.</p>';

  var SECTIONS = [
    { key: 'hero', label: 'Hero banner', desc: 'Big title over a photo', thumb: ['#3a3f47', '1'],
      make: function () { return S({ theme: 'dark', bgImage: 'assets/images/hero-office.jpg', overlay: 0.4, minHeight: '75vh', align: 'center', valign: 'middle', width: 'narrow' }, '1', [[H(1, 'Big headline here'), H(4, 'A short supporting sentence.', { maxWidth: '560px', align: 'center' }), BTN('Request a Quote', '/contact/', { align: 'center' })]]); } },
    { key: 'text-image', label: 'Text + image', desc: 'Two columns', thumb: ['#e0e0db', '1-1'],
      make: function () { return S({ theme: 'light', valign: 'middle' }, '1-1', [[H(2, 'Section title'), T(LOREM), BTN('Learn more', '/about/')], [IMG('')]]); } },
    { key: 'image-text', label: 'Image + text', desc: 'Two columns', thumb: ['#ffffff', '1-1'],
      make: function () { return S({ theme: 'white', valign: 'middle' }, '1-1', [[IMG('')], [H(2, 'Section title'), T(LOREM), BTN('Learn more', '/about/')]]); } },
    { key: 'text', label: 'Text', desc: 'Heading and paragraph', thumb: ['#e0e0db', '1'],
      make: function () { return S({ theme: 'light' }, '1', [[H(2, 'Section title'), T(LOREM, { maxWidth: '700px' })]]); } },
    { key: 'three', label: 'Three columns', desc: 'Services, features…', thumb: ['#ffffff', '1-1-1'],
      make: function () { return S({ theme: 'white' }, '1-1-1', [1, 2, 3].map(function (n) { return [H(4, 'Feature ' + n), T('<p>A short description.</p>')]; })); } },
    { key: 'gallery', label: 'Photo gallery', desc: 'Grid of photos', thumb: ['#ffffff', '1'],
      make: function () { return S({ theme: 'white' }, '1', [[H(2, 'Gallery'), { type: 'gallery', columns: 3, images: [] }]]); } },
    { key: 'cards', label: 'Project cards', desc: 'Linked tiles', thumb: ['#ffffff', '1'],
      make: function () { return S({ theme: 'white' }, '1', [[H(2, 'Projects'), BLOCKS.cards.make()]]); } },
    { key: 'cta', label: 'Call to action', desc: 'Centered, navy', thumb: ['#253551', '1'],
      make: function () { return S({ theme: 'navy', align: 'center', width: 'narrow' }, '1', [[H(2, 'Ready to start your project?'), T('<p>Get in touch for a free quote.</p>'), BTN('Request a Quote', '/contact/')]]); } },
    { key: 'contact', label: 'Contact form', desc: 'Text + form', thumb: ['#253551', '1-1'],
      make: function () { return S({ theme: 'navy' }, '1-1', [[H(1, 'Contact us'), T('<p>Interested in working together? Fill out some info and we will be in touch shortly.</p>')], [BLOCKS.form.make()]]); } },
    { key: 'blank', label: 'Blank section', desc: 'Empty, one column', thumb: ['#e0e0db', '1'],
      make: function () { return S({ theme: 'light' }, '1', [[]]); } }
  ];

  var LAYOUT_LABELS = [['1', 'One column'], ['1-1', 'Two columns (50 / 50)'], ['3-2', 'Two columns (60 / 40)'], ['2-3', 'Two columns (40 / 60)'],
    ['2-1', 'Two columns (67 / 33)'], ['1-2', 'Two columns (33 / 67)'], ['1-1-1', 'Three columns'], ['1-1-1-1', 'Four columns']];

  // ---------------------------------------------------------------- model helpers
  function ensureIds(site) {
    function sec(s) {
      if (!s.id) s.id = uid('s');
      s.style = s.style || {};
      (s.columns = s.columns || [{ blocks: [] }]).forEach(function (c) {
        if (!c.id) c.id = uid('c');
        (c.blocks = c.blocks || []).forEach(function (b) { if (!b.id) b.id = uid('b'); });
      });
    }
    (site.pages || []).forEach(function (p) { if (!p.id) p.id = uid('p'); (p.sections = p.sections || []).forEach(sec); });
    if (site.footer) sec(site.footer);
    site.nav = site.nav || [];
    site.settings = site.settings || {};
    site.settings.theme = site.settings.theme || {};
    return site;
  }
  function freshIds(o) {
    if (Array.isArray(o)) { o.forEach(freshIds); return o; }
    if (o && typeof o === 'object') {
      if (o.id) o.id = o.id.charAt(0) + Math.random().toString(36).slice(2, 9);
      Object.keys(o).forEach(function (k) { if (typeof o[k] === 'object') freshIds(o[k]); });
    }
    return o;
  }
  function newSection(tpl) { var s = tpl.make(); var site = { pages: [{ id: 'x', sections: [s] }] }; ensureIds(site); return s; }
  function newBlock(type) { var b = BLOCKS[type].make(); b.id = uid('b'); return b; }

  function page() {
    return state.site.pages.filter(function (p) { return p.id === state.pageId; })[0] || state.site.pages[0];
  }
  function allSections() { return page().sections.concat(state.site.footer ? [state.site.footer] : []); }
  function findSection(id) {
    var list = page().sections;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return { section: list[i], list: list, index: i };
    if (state.site.footer && state.site.footer.id === id) return { section: state.site.footer, list: null, index: -1, footer: true };
    return null;
  }
  function findCol(id) {
    var secs = allSections();
    for (var i = 0; i < secs.length; i++) for (var j = 0; j < secs[i].columns.length; j++) {
      if (secs[i].columns[j].id === id) return { col: secs[i].columns[j], section: secs[i] };
    }
    return null;
  }
  function findBlock(id) {
    var secs = allSections();
    for (var i = 0; i < secs.length; i++) for (var j = 0; j < secs[i].columns.length; j++) {
      var bl = secs[i].columns[j].blocks;
      for (var k = 0; k < bl.length; k++) if (bl[k].id === id) return { block: bl[k], col: secs[i].columns[j], section: secs[i], index: k };
    }
    return null;
  }
  function pageUrl(p) { return R.pageUrl(p); }

  // ---------------------------------------------------------------- history & dirty state
  var editSession = false;
  function pushUndo() {
    state.undo.push(JSON.stringify(state.site));
    if (state.undo.length > 150) state.undo.shift();
    state.redo = [];
  }
  function markDirty() {
    state.dirty = JSON.stringify(state.site) !== state.savedJson;
    saveDraft();
    renderStatus();
  }
  var saveDraft = debounce(function () {
    try {
      if (state.dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), json: JSON.stringify(state.site) }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* storage full (large inline images) — ignore */ }
  }, 600);

  // Apply a structural change: snapshot, mutate, re-render.
  function change(fn, opts) {
    opts = opts || {};
    var before = JSON.stringify([state.sel, state.tab]);
    pushUndo();
    editSession = false;
    fn();
    markDirty();
    renderCanvas();
    if (opts.inspector !== false) {
      renderInspector.keep = before === JSON.stringify([state.sel, state.tab]);
      renderInspector();
    }
    renderTopbar();
  }
  function undo() {
    if (!state.undo.length) return;
    state.redo.push(JSON.stringify(state.site));
    state.site = JSON.parse(state.undo.pop());
    afterHistory();
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(JSON.stringify(state.site));
    state.site = JSON.parse(state.redo.pop());
    afterHistory();
  }
  function afterHistory() {
    editSession = false;
    if (!state.site.pages.some(function (p) { return p.id === state.pageId; })) state.pageId = state.site.pages[0].id;
    if (state.sel && !(state.sel.kind === 'block' ? findBlock(state.sel.id) : findSection(state.sel.id))) state.sel = null;
    markDirty();
    renderAll();
  }

  // ---------------------------------------------------------------- rendering
  var stage, root;
  function renderAll() { renderTopbar(); renderLeft(); renderCanvas(); renderInspector(); }

  function renderCanvas() {
    var st = stage.scrollTop;
    $('#fe-theme').textContent = R.themeCss(state.site);
    var fonts = R.fontsUrl(state.site);
    if ($('#fe-fonts').getAttribute('href') !== fonts) $('#fe-fonts').setAttribute('href', fonts);
    var live = state.preview || state.visitor;
    document.body.classList.toggle('fe-preview', state.preview);
    document.body.classList.toggle('fe-visitor', state.visitor);
    document.body.classList.toggle('fe-mobile', state.mobile);
    root.innerHTML = R.renderPage(state.site, page(), { edit: !live, assetPrefix: ASSET });
    root.classList.toggle('fe-edit', !live);
    if (!live) decorate();
    else wirePreview();
    showPendingImages();
    applySelection();
    stage.scrollTop = st;
    document.title = 'Editing: ' + (page().title || 'Page') + ' — Site Editor';
  }
  var scheduleCanvas = debounce(renderCanvas, 200);

  function tbButton(act, id, ic, title) {
    return '<button type="button" data-act="' + act + '" data-id="' + esc(id) + '" title="' + esc(title) + '">' + icon(ic) + '</button>';
  }
  function decorate() {
    $$('[data-section-id]', root).forEach(function (sec) {
      var id = sec.getAttribute('data-section-id');
      var footer = !!sec.closest('.site-footer');
      var tb = document.createElement('div');
      tb.className = 'fe-tb fe-tb-section';
      tb.innerHTML = footer
        ? '<span class="fe-handle" style="cursor:pointer" data-act="s-select" data-id="' + esc(id) + '">' + icon('gear') + 'Footer</span>'
        : '<span class="fe-handle" data-drag="section" data-id="' + esc(id) + '" title="Drag to move this section">' + icon('drag') + 'Section</span>' +
          tbButton('s-up', id, 'up', 'Move section up') + tbButton('s-down', id, 'down', 'Move section down') +
          tbButton('s-select', id, 'gear', 'Section settings') + tbButton('s-dup', id, 'copy', 'Duplicate section') + tbButton('s-del', id, 'trash', 'Delete section');
      sec.insertBefore(tb, sec.firstChild);
    });
    $$('.block[data-block-id]', root).forEach(function (b) {
      var id = b.getAttribute('data-block-id');
      var type = b.getAttribute('data-type');
      var tb = document.createElement('div');
      tb.className = 'fe-tb fe-tb-block';
      tb.innerHTML = '<span class="fe-handle" data-drag="block" data-id="' + esc(id) + '" title="Drag to move">' + icon('drag') + esc((BLOCKS[type] || { label: type }).label) + '</span>' +
        tbButton('b-up', id, 'up', 'Move up') + tbButton('b-down', id, 'down', 'Move down') +
        tbButton('b-dup', id, 'copy', 'Duplicate') + tbButton('b-del', id, 'trash', 'Delete');
      b.appendChild(tb);
    });
    $$('[data-edit]', root).forEach(function (el) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
    });
    var footer = $('.site-footer', root);
    if (footer) footer.insertBefore(h('div', { class: 'fe-footer-tag' }, 'Footer — shown on every page'), footer.firstChild);
  }

  function wirePreview() {
    var header = $('.site-header', root), toggle = header && $('.menu-toggle', header);
    if (toggle) toggle.addEventListener('click', function () { header.classList.toggle('open'); });
    $$('.b-gallery', root).forEach(function (g) {
      var imgs = $$('img', g);
      imgs.forEach(function (img, i) { img.addEventListener('click', function () { openLightbox(imgs, i); }); });
    });
  }
  function openLightbox(imgs, index) {
    var lb = h('div', { class: 'lightbox', html: '<img alt=""><button class="lb-close" aria-label="Close">×</button>' +
      (imgs.length > 1 ? '<button class="lb-prev" aria-label="Previous">‹</button><button class="lb-next" aria-label="Next">›</button>' : '') });
    var big = $('img', lb);
    function show(i) { index = (i + imgs.length) % imgs.length; big.src = imgs[index].src; }
    lb.addEventListener('click', function (e) {
      if (e.target.classList.contains('lb-prev')) show(index - 1);
      else if (e.target.classList.contains('lb-next')) show(index + 1);
      else if (e.target !== big) lb.remove();
    });
    show(index);
    document.body.appendChild(lb);
  }
  // In preview, links move between pages inside the editor instead of leaving it.
  function onLiveClick(e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^(https?:|mailto:|tel:)/i.test(href)) return;
    e.preventDefault();
    var parts = href.split('#'), path = parts[0], frag = parts[1];
    if (path) {
      var p = R.findPage(state.site, path);
      if (p && p.id !== state.pageId) goToPage(p.id);
      else if (p) { renderCanvas(); stage.scrollTop = 0; }
    }
    var t = frag && root.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(frag) : frag));
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  }
  function setVisitor(on) {
    state.visitor = on;
    if (on) { state.sel = null; state.preview = false; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
    closeSheets();
    renderAll();
    stage.scrollTop = 0;
  }

  function applySelection() {
    $$('.fe-sel', root).forEach(function (e) { e.classList.remove('fe-sel'); });
    if (!state.sel) return;
    var sel = state.sel.kind === 'block' ? '[data-block-id="' + state.sel.id + '"]' : '[data-section-id="' + state.sel.id + '"]';
    var el = $(sel, root);
    if (el) el.classList.add('fe-sel');
  }
  function select(kind, id) {
    var same = state.sel && state.sel.kind === kind && state.sel.id === id && state.tab === 'selection';
    state.sel = kind ? { kind: kind, id: id } : null;
    state.tab = 'selection';
    applySelection();
    if (!same) renderInspector();
  }

  // ---------------------------------------------------------------- top bar
  function renderTopbar() {
    var bar = $('#fe-topbar');
    var pages = state.site.pages.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === page().id ? ' selected' : '') + '>' + esc((p.slug ? '' : '⌂ ') + (p.fullTitle && !p.slug ? 'Home' : p.title)) + '  —  ' + esc(pageUrl(p)) + '</option>';
    }).join('');
    bar.innerHTML =
      '<span class="fe-brand">Site Editor' + (DEMO ? ' <small style="opacity:.6;font-weight:400">(test copy)</small>' : '') + '</span>' +
      '<div class="fe-group"><select id="fe-page" title="Page you are editing">' + pages + '</select>' +
      '<button class="fe-tbtn" data-top="add-page" title="Add a new page">' + icon('plus') + '<span class="fe-label">Page</span></button>' +
      '<button class="fe-tbtn" data-top="page-settings" title="Page settings">' + icon('gear') + '</button></div>' +
      '<div class="fe-group">' +
      '<button class="fe-tbtn" data-top="undo" title="Undo (Ctrl+Z)"' + (state.undo.length ? '' : ' disabled') + '>' + icon('undo') + '</button>' +
      '<button class="fe-tbtn" data-top="redo" title="Redo (Ctrl+Shift+Z)"' + (state.redo.length ? '' : ' disabled') + '>' + icon('redo') + '</button></div>' +
      '<div class="fe-group">' +
      '<button class="fe-tbtn' + (!state.mobile ? ' on' : '') + '" data-top="desktop" title="Desktop view">' + icon('desktop') + '</button>' +
      '<button class="fe-tbtn' + (state.mobile ? ' on' : '') + '" data-top="mobile" title="Phone view">' + icon('phone') + '</button>' +
      '<button class="fe-tbtn' + (state.preview ? ' on' : '') + '" data-top="preview" title="Preview without editing outlines">' + icon('eye') + '<span class="fe-label">Preview</span></button></div>' +
      '<span class="fe-spacer"></span>' +
      '<span class="fe-status" id="fe-status"></span>' +
      (DEMO ? '<button class="fe-tbtn fe-visit" data-top="visit" title="See the website as visitors do">' + icon('external') + '<span class="fe-label">View site</span></button>'
        : '<a class="fe-tbtn" href="' + esc(pageUrl(page())) + '" target="_blank" rel="noopener" title="Open the saved version of this page">' + icon('external') + '<span class="fe-label">View site</span></a>') +
      '<button class="fe-tbtn fe-save" data-top="save" title="Publish (Ctrl+S)">' + (state.server || DEMO ? 'Publish' : 'Save') + '</button>';
    $('#fe-page').addEventListener('change', function (e) { goToPage(e.target.value); });
    renderStatus();
  }
  function renderStatus() {
    var s = $('#fe-status');
    if (!s) return;
    s.textContent = state.dirty ? '● Unpublished changes' : 'All changes published';
    document.body.classList.toggle('fe-dirty', state.dirty);
    s.classList.toggle('dirty', state.dirty);
    var u = $('[data-top="undo"]'), r = $('[data-top="redo"]');
    if (u) u.disabled = !state.undo.length;
    if (r) r.disabled = !state.redo.length;
  }
  function goToPage(id) {
    state.pageId = id;
    state.sel = null;
    if (state.tab === 'selection') state.tab = 'selection';
    if (!DEMO) history.replaceState(null, '', '#page=' + encodeURIComponent(id));
    stage.scrollTop = 0;
    renderAll();
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-top]');
    if (!b || b.disabled) return;
    var a = b.getAttribute('data-top');
    if (a === 'undo') undo();
    else if (a === 'redo') redo();
    else if (a === 'desktop' || a === 'mobile') { state.mobile = a === 'mobile'; renderTopbar(); renderCanvas(); }
    else if (a === 'preview') { state.preview = !state.preview; renderTopbar(); renderCanvas(); }
    else if (a === 'save') save();
    else if (a === 'visit') setVisitor(true);
    else if (a === 'add-page') addPage();
    else if (a === 'page-settings') { state.tab = 'page'; renderInspector(); if (isPhone()) openSheet('right'); }
  });

  // ---------------------------------------------------------------- phone layout: panels become bottom sheets
  function openSheet(which) {
    document.body.classList.toggle('fe-sheet-left', which === 'left');
    document.body.classList.toggle('fe-sheet-right', which === 'right');
    $$('[data-dock]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-dock') === which); });
  }
  function closeSheets() { if (isPhone()) openSheet(null); }
  document.addEventListener('click', function (e) {
    var d = e.target.closest('[data-dock]');
    if (!d) return;
    var which = d.getAttribute('data-dock');
    openSheet(document.body.classList.contains('fe-sheet-' + which) ? null : which);
  });

  // ---------------------------------------------------------------- left panel (palette)
  function renderLeft() {
    var left = $('#fe-left');
    var blocks = Object.keys(BLOCKS).map(function (k) {
      return '<div class="fe-pal" data-new-block="' + k + '" title="Drag onto the page, or click to add">' + icon(k) + '<span>' + esc(BLOCKS[k].label) + '</span></div>';
    }).join('');
    var secs = SECTIONS.map(function (t) {
      var cols = R.LAYOUTS[t.thumb[1]];
      var dark = /^#(2|3)/.test(t.thumb[0]);
      var thumb = '<div class="fe-sec-thumb" style="background:' + t.thumb[0] + ';color:' + (dark ? '#fff' : '#333') + ';grid-template-columns:' + cols.map(function (c) { return c + 'fr'; }).join(' ') + ';border:1px solid #d5d8de">' +
        cols.map(function () { return '<i></i>'; }).join('') + '</div>';
      return '<div class="fe-sec-item" data-new-section="' + t.key + '" title="Drag onto the page, or click to add">' + thumb + '<div><b>' + esc(t.label) + '</b><small>' + esc(t.desc) + '</small></div></div>';
    }).join('');
    left.innerHTML = '<div class="fe-panel-h">Blocks</div><p class="fe-hint">Drag onto the page, or tap to add after the selected item.</p>' +
      '<div class="fe-palette">' + blocks + '</div>' +
      '<div class="fe-panel-h">Sections</div><div class="fe-sec-list">' + secs + '</div>';
  }

  // Click-to-add from the palette
  function addBlockSmart(type) {
    closeSheets();
    var b = newBlock(type), target = null;
    if (state.sel && state.sel.kind === 'block') {
      var loc = findBlock(state.sel.id);
      if (loc) target = { col: loc.col, index: loc.index + 1 };
    }
    if (!target && state.sel && state.sel.kind === 'section') {
      var s = findSection(state.sel.id);
      if (s) target = { col: s.section.columns[0], index: s.section.columns[0].blocks.length };
    }
    if (!target && page().sections.length) {
      var last = page().sections[page().sections.length - 1];
      target = { col: last.columns[0], index: last.columns[0].blocks.length };
    }
    change(function () {
      if (target) target.col.blocks.splice(target.index, 0, b);
      else { var s = newSection(SECTIONS.filter(function (t) { return t.key === 'blank'; })[0]); s.columns[0].blocks.push(b); page().sections.push(s); }
      state.sel = { kind: 'block', id: b.id }; state.tab = 'selection';
    });
    scrollIntoView('[data-block-id="' + b.id + '"]');
  }
  function addSectionSmart(key) {
    closeSheets();
    var s = newSection(SECTIONS.filter(function (t) { return t.key === key; })[0]);
    var list = page().sections, index = list.length;
    if (state.sel) {
      var loc = state.sel.kind === 'section' ? findSection(state.sel.id) : (findBlock(state.sel.id) ? findSection(findBlock(state.sel.id).section.id) : null);
      if (loc && loc.list) index = loc.index + 1;
    }
    change(function () { list.splice(index, 0, s); state.sel = { kind: 'section', id: s.id }; state.tab = 'selection'; });
    scrollIntoView('[data-section-id="' + s.id + '"]');
  }
  function scrollIntoView(sel) {
    var el = $(sel, root);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---------------------------------------------------------------- drag & drop (pointer based)
  var drag = null, ghost, indicator;
  function startDrag(e, payload, srcEl) {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { payload: payload, srcEl: srcEl, x: e.clientX, y: e.clientY, started: false, target: null };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', cancelDrag);
  }
  function onDragMove(e) {
    if (!drag) return;
    drag.lastX = e.clientX; drag.lastY = e.clientY;
    if (!drag.started) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.started = true;
      closeSheets();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.body.classList.add('fe-dragging');
      ghost.textContent = drag.payload.label;
      ghost.style.display = 'block';
      if (drag.payload.moveEl) drag.payload.moveEl.classList.add('fe-drag-src');
      drag.scroller = setInterval(autoScroll, 16);
    }
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    updateTarget();
  }
  function autoScroll() {
    if (!drag) return;
    var r = stage.getBoundingClientRect(), y = drag.lastY, speed = 0;
    if (y < r.top + 60 && y > r.top - 40) speed = -Math.max(4, (r.top + 60 - y) / 3);
    else if (y > r.bottom - 60) speed = Math.max(4, (y - (r.bottom - 60)) / 3);
    if (speed) { stage.scrollTop += speed; updateTarget(); }
  }
  function updateTarget() {
    var t = drag.payload.kind === 'section' ? sectionTarget(drag.lastX, drag.lastY) : blockTarget(drag.lastX, drag.lastY, drag.payload.id);
    drag.target = t;
    $$('.fe-dropcol', root).forEach(function (c) { c.classList.remove('fe-dropcol'); });
    if (!t) { indicator.style.display = 'none'; return; }
    if (t.colEl) t.colEl.classList.add('fe-dropcol');
    indicator.style.display = 'block';
    indicator.style.left = t.line.left + 'px';
    indicator.style.top = (t.line.top - 2) + 'px';
    indicator.style.width = t.line.width + 'px';
    indicator.style.height = '4px';
  }
  function inStage(x, y) {
    var r = stage.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function nearestCol(sec, x) {
    var cols = $$('[data-col-id]', sec), best = null, dist = Infinity;
    cols.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (d < dist) { dist = d; best = c; }
    });
    return best;
  }
  function blockTarget(x, y, movingId) {
    if (!inStage(x, y)) return null;
    var el = document.elementFromPoint(x, y);
    if (!el || !root.contains(el)) return null;
    var col = el.closest('[data-col-id]');
    if (!col) {
      var sec = el.closest('[data-section-id]');
      if (sec) col = nearestCol(sec, x);
    }
    if (!col) {
      if (el.closest('.page-empty')) {
        var pr = el.closest('.page-empty').getBoundingClientRect();
        return { newSection: true, line: { left: pr.left, width: pr.width, top: pr.top + pr.height / 2 } };
      }
      return null;
    }
    var cr = col.getBoundingClientRect();
    var blocks = $$(':scope > .block[data-block-id]', col).filter(function (b) { return b.getAttribute('data-block-id') !== movingId; });
    var idx = blocks.length;
    for (var i = 0; i < blocks.length; i++) {
      var r = blocks[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { idx = i; break; }
    }
    var top;
    if (!blocks.length) top = cr.top + Math.min(cr.height / 2, 30);
    else if (idx < blocks.length) {
      var rr = blocks[idx].getBoundingClientRect();
      var prev = idx > 0 ? blocks[idx - 1].getBoundingClientRect() : null;
      top = prev ? (prev.bottom + rr.top) / 2 : rr.top - 8;
    } else top = blocks[blocks.length - 1].getBoundingClientRect().bottom + 8;
    return { colId: col.getAttribute('data-col-id'), colEl: col, index: idx, line: { left: cr.left, width: cr.width, top: top } };
  }
  function sectionTarget(x, y) {
    if (!inStage(x, y)) return null;
    var main = $('[data-sections]', root);
    if (!main) return null;
    var mr = main.getBoundingClientRect();
    var secs = $$(':scope > [data-section-id]', main).filter(function (s) { return s.getAttribute('data-section-id') !== drag.payload.id; });
    var idx = secs.length;
    for (var i = 0; i < secs.length; i++) {
      var r = secs[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { idx = i; break; }
    }
    var top = !secs.length ? mr.top + 10 : idx < secs.length ? secs[idx].getBoundingClientRect().top : secs[secs.length - 1].getBoundingClientRect().bottom;
    var sr = stage.getBoundingClientRect();
    top = Math.max(sr.top + 4, Math.min(sr.bottom - 4, top));
    return { index: idx, line: { left: mr.left, width: mr.width, top: top } };
  }
  function onDragEnd() {
    if (!drag) return;
    var d = drag;
    cleanupDrag();
    var p = d.payload;
    if (!d.started) { // treated as a click
      if (p.newBlock) addBlockSmart(p.newBlock);
      else if (p.newSection) addSectionSmart(p.newSection);
      else if (p.kind === 'block') select('block', p.id);
      else if (p.kind === 'section') select('section', p.id);
      return;
    }
    var t = d.target;
    if (!t) return;
    if (p.kind === 'section') {
      change(function () {
        var list = page().sections, s;
        if (p.newSection) s = newSection(SECTIONS.filter(function (x) { return x.key === p.newSection; })[0]);
        else { var loc = findSection(p.id); s = loc.list.splice(loc.index, 1)[0]; }
        list.splice(t.index, 0, s);
        state.sel = { kind: 'section', id: s.id }; state.tab = 'selection';
      });
      return;
    }
    change(function () {
      var b;
      if (p.newBlock) b = newBlock(p.newBlock);
      else { var loc = findBlock(p.id); b = loc.col.blocks.splice(loc.index, 1)[0]; }
      if (t.newSection) {
        var s = newSection(SECTIONS.filter(function (x) { return x.key === 'blank'; })[0]);
        s.columns[0].blocks.push(b);
        page().sections.push(s);
      } else findCol(t.colId).col.blocks.splice(t.index, 0, b);
      state.sel = { kind: 'block', id: b.id }; state.tab = 'selection';
    });
  }
  function cancelDrag() { cleanupDrag(); }
  function cleanupDrag() {
    if (!drag) return;
    clearInterval(drag.scroller);
    if (drag.payload.moveEl) drag.payload.moveEl.classList.remove('fe-drag-src');
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', cancelDrag);
    document.body.classList.remove('fe-dragging');
    ghost.style.display = 'none';
    indicator.style.display = 'none';
    $$('.fe-dropcol', root).forEach(function (c) { c.classList.remove('fe-dropcol'); });
    drag = null;
  }

  document.addEventListener('pointerdown', function (e) {
    var pal = e.target.closest('[data-new-block]');
    if (pal) return startDrag(e, { kind: 'block', newBlock: pal.getAttribute('data-new-block'), label: BLOCKS[pal.getAttribute('data-new-block')].label });
    var ps = e.target.closest('[data-new-section]');
    if (ps) {
      var t = SECTIONS.filter(function (x) { return x.key === ps.getAttribute('data-new-section'); })[0];
      return startDrag(e, { kind: 'section', newSection: t.key, label: t.label });
    }
    var hd = e.target.closest('[data-drag]');
    if (hd && root.contains(hd)) {
      var kind = hd.getAttribute('data-drag'), id = hd.getAttribute('data-id');
      var el = kind === 'block' ? hd.closest('[data-block-id]') : hd.closest('[data-section-id]');
      startDrag(e, { kind: kind, id: id, moveEl: el, label: kind === 'block' ? (BLOCKS[el.getAttribute('data-type')] || {}).label || 'Block' : 'Section' });
    }
  });

  // ---------------------------------------------------------------- dropping image files from the computer
  function fileTarget(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !root.contains(el)) return null;
    var card = el.closest('.card');
    var blk = el.closest('[data-block-id]');
    if (blk) {
      var type = blk.getAttribute('data-type');
      if (type === 'image') return { kind: 'image', el: blk, id: blk.getAttribute('data-block-id') };
      if (type === 'gallery') return { kind: 'gallery', el: blk, id: blk.getAttribute('data-block-id') };
      if (type === 'cards' && card) return { kind: 'card', el: card, id: blk.getAttribute('data-block-id'), index: $$('.card', blk).indexOf(card) };
    }
    var sec = el.closest('[data-section-id]');
    if (sec && !el.closest('[data-col-id]') && !blk) return { kind: 'section-bg', el: sec, id: sec.getAttribute('data-section-id') };
    var t = blockTarget(e.clientX, e.clientY, null);
    if (t && !t.newSection) return { kind: 'column', el: t.colEl, col: t };
    return null;
  }
  var lastFileEl = null;
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  document.addEventListener('dragover', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    var t = fileTarget(e);
    if (lastFileEl && (!t || t.el !== lastFileEl)) lastFileEl.classList.remove('fe-filedrop');
    if (t) { t.el.classList.add('fe-filedrop'); lastFileEl = t.el; e.dataTransfer.dropEffect = 'copy'; }
    else e.dataTransfer.dropEffect = 'none';
  });
  document.addEventListener('dragleave', function (e) {
    if (lastFileEl && !e.relatedTarget) { lastFileEl.classList.remove('fe-filedrop'); lastFileEl = null; }
  });
  document.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (lastFileEl) { lastFileEl.classList.remove('fe-filedrop'); lastFileEl = null; }
    if (e.target.closest && e.target.closest('.fe-modal')) return; // handled by the image picker
    var t = fileTarget(e);
    var files = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return /^image\//.test(f.type); });
    if (!t || !files.length) return;
    if (t.kind !== 'gallery' && t.kind !== 'column') files = files.slice(0, 1);
    toast('Uploading ' + files.length + ' image' + (files.length > 1 ? 's' : '') + '…');
    Promise.all(files.map(uploadFile)).then(function (srcs) {
      change(function () {
        if (t.kind === 'image') findBlock(t.id).block.src = srcs[0];
        else if (t.kind === 'gallery') { var g = findBlock(t.id).block; srcs.forEach(function (s) { g.images.push({ src: s, alt: '' }); }); }
        else if (t.kind === 'card') findBlock(t.id).block.items[t.index].image = srcs[0];
        else if (t.kind === 'section-bg') { var s = findSection(t.id).section; s.style.bgImage = srcs[0]; if (!s.style.theme || s.style.theme === 'light' || s.style.theme === 'white') s.style.theme = 'dark'; }
        else if (t.kind === 'column') {
          var col = findCol(t.col.colId).col;
          srcs.forEach(function (s, i) { var b = newBlock('image'); b.src = s; col.blocks.splice(t.col.index + i, 0, b); });
        }
      });
      toast('Image added');
    }).catch(function (err) { toast('Upload failed: ' + err.message, true); });
  });

  // ---------------------------------------------------------------- uploads & image picker
  function authHeaders(extra) {
    var hd = Object.assign({}, extra || {});
    var pw = getPassword();
    if (pw) hd['X-Editor-Password'] = pw;
    return hd;
  }
  function getPassword() {
    try { return sessionStorage.getItem(PW_KEY) || localStorage.getItem(PW_KEY) || ''; } catch (e) { return ''; }
  }
  function setPassword(pw, remember) {
    try {
      sessionStorage.setItem(PW_KEY, pw);
      if (remember) localStorage.setItem(PW_KEY, pw); else localStorage.removeItem(PW_KEY);
    } catch (e) { /* private mode */ }
  }
  function forgetPassword() {
    try { sessionStorage.removeItem(PW_KEY); localStorage.removeItem(PW_KEY); } catch (e) { /* ignore */ }
  }
  function ping() {
    return fetch('/api/ping', { headers: authHeaders(), cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  // Password screen. Resolves once the server accepts the password.
  function login(message) {
    return new Promise(function (resolve) {
      var input = h('input', { class: 'fe-input', type: 'password', autocomplete: 'current-password', placeholder: 'Editor password', style: 'font-size:16px' });
      var remember = h('input', { type: 'checkbox', checked: true });
      var err = h('p', { class: 'fe-hint', style: 'color:#b3261e;margin:8px 0 0;min-height:1em' }, message || '');
      var m;
      function go() {
        if (!input.value) return;
        setPassword(input.value, remember.checked);
        err.textContent = 'Checking…';
        ping().then(function (p) {
          if (p && p.authorized) { m.close(); resolve(); }
          else { forgetPassword(); err.textContent = 'That password is not right.'; input.select(); }
        });
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      m = modal('Sign in to edit your website', [
        h('form', { onsubmit: function (e) { e.preventDefault(); go(); } }, input,
          h('label', { class: 'fe-check' }, remember, 'Remember me on this device'), err)
      ], [h('button', { class: 'fe-btn primary', type: 'button', onclick: go }, 'Sign in')], { locked: true });
      setTimeout(function () { input.focus(); }, 50);
    });
  }
  function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
      var max = CFG.maxImage || 1800, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 1.5e6) return file;
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      var png = file.type === 'image/png';
      return new Promise(function (res) {
        c.toBlob(function (blob) {
          res(new File([blob], file.name.replace(/\.[^.]+$/, '') + (png ? '.png' : '.jpg'), { type: blob.type }));
        }, png ? 'image/png' : 'image/jpeg', 0.82);
      });
    }).catch(function () { return file; });
  }
  function uploadFile(file) {
    return prepareImage(file).then(function (f) {
      if (!state.server) {
        return new Promise(function (res, rej) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = rej;
          fr.readAsDataURL(f);
        });
      }
      // Kept in the browser and sent with the next Publish, in the same save as the text.
      var ext = (f.name.match(/\.(jpe?g|png|webp|gif)$/i) || ['.jpg'])[0].toLowerCase();
      var base = slugify(f.name.replace(/\.[^.]+$/, '')).slice(0, 40) || 'photo';
      var p = 'assets/uploads/' + base + '-' + Math.random().toString(36).slice(2, 7) + ext;
      state.pending[p] = f;
      state.blobUrls[p] = URL.createObjectURL(f);
      return p;
    });
  }
  function libraryImages() {
    var used = {};
    JSON.stringify(state.site).replace(/"((?:assets\/|https?:)[^"]+?\.(?:jpe?g|png|gif|webp|svg|avif))"/gi, function (m, s) { used[s] = 1; return m; });
    Object.keys(state.pending).forEach(function (k) { used[k] = 1; });
    if (!state.server) return Promise.resolve(Object.keys(used));
    return fetch('/api/images', { headers: authHeaders() }).then(function (r) { return r.json(); })
      .then(function (j) { (j.images || []).forEach(function (s) { used[s] = 1; }); return Object.keys(used); })
      .catch(function () { return Object.keys(used); });
  }
  function imgUrl(src) {
    if (state.blobUrls[src]) return state.blobUrls[src];
    return /^(https?:|data:|blob:|\/)/.test(src) ? src : ASSET + src;
  }
  // Swap in local copies of photos that haven't been published yet.
  function showPendingImages() {
    $$('img', root).forEach(function (img) {
      var k = (img.getAttribute('src') || '').replace(/^\//, '');
      if (state.blobUrls[k]) img.src = state.blobUrls[k];
    });
  }

  // Opens the image picker; cb receives an array of srcs.
  function pickImages(opts, cb) {
    opts = opts || {};
    var input = h('input', { type: 'file', accept: 'image/*', multiple: opts.multiple ? true : null, style: 'display:none' });
    var zone = h('div', { class: 'fe-drop-zone' },
      h('p', { style: 'margin:0 0 10px' }, 'Drag ' + (opts.multiple ? 'photos' : 'a photo') + ' from your computer here, or'),
      h('button', { class: 'fe-btn primary', type: 'button', onclick: function () { input.click(); } }, 'Choose from computer…'), input);
    var url = h('input', { class: 'fe-input', type: 'url', placeholder: 'https://… (paste an image address)' });
    var lib = h('div', { class: 'fe-lib' }, h('p', { class: 'fe-hint' }, 'Loading…'));
    var m = modal(opts.title || 'Choose image', [zone,
      h('div', { class: 'fe-row', style: 'margin-top:14px' }, url, h('button', { class: 'fe-btn', type: 'button', style: 'flex:none', onclick: function () { if (url.value.trim()) { m.close(); cb([url.value.trim()]); } } }, 'Use address')),
      h('h4', { style: 'margin:18px 0 0;font:600 12px system-ui;text-transform:uppercase;letter-spacing:.06em;color:#6b7487' }, 'Your images'), lib]);
    function handle(files) {
      files = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
      if (!opts.multiple) files = files.slice(0, 1);
      if (!files.length) return;
      zone.querySelector('p').textContent = 'Uploading…';
      Promise.all(files.map(uploadFile)).then(function (srcs) { m.close(); cb(srcs); })
        .catch(function (e) { zone.querySelector('p').textContent = 'Upload failed: ' + e.message; });
    }
    input.addEventListener('change', function () { handle(input.files); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); zone.classList.remove('over'); handle(e.dataTransfer.files); });
    libraryImages().then(function (list) {
      lib.innerHTML = '';
      if (!list.length) lib.appendChild(h('p', { class: 'fe-hint' }, 'No images yet.'));
      list.forEach(function (src) {
        lib.appendChild(h('button', { type: 'button', title: src, onclick: function () { m.close(); cb([src]); } }, h('img', { src: imgUrl(src), loading: 'lazy', alt: '' })));
      });
    });
  }

  function modal(title, body, footer, opts) {
    opts = opts || {};
    var back = h('div', { class: 'fe-modal-back' });
    var close = function () { back.remove(); document.removeEventListener('keydown', key); if (opts.onClose) opts.onClose(); };
    var key = function (e) { if (e.key === 'Escape' && !opts.locked) close(); };
    back.appendChild(h('div', { class: 'fe-modal', role: 'dialog' },
      h('div', { class: 'fe-modal-h' }, h('b', null, title), opts.locked ? null : h('button', { class: 'fe-btn small', type: 'button', onclick: close }, 'Close')),
      h('div', { class: 'fe-modal-b' }, body),
      footer ? h('div', { class: 'fe-modal-f' }, footer) : null));
    if (!opts.locked) back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', key);
    $('#fe-modal-root').appendChild(back);
    return { close: close, el: back };
  }

  function askConfirm(title, message, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false, m;
      function finish(v) { if (done) return; done = true; m.close(); resolve(v); }
      m = modal(title, h('p', { style: 'margin:0;font-size:15px;line-height:1.45' }, message), [
        h('button', { class: 'fe-btn', type: 'button', onclick: function () { finish(false); } }, 'Cancel'),
        h('button', { class: 'fe-btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: function () { finish(true); } }, okLabel || 'OK')
      ], { onClose: function () { if (!done) { done = true; resolve(false); } } });
    });
  }
  function askText(title, label, value, okLabel, checkboxLabel) {
    return new Promise(function (resolve) {
      var done = false, m;
      var input = h('input', { class: 'fe-input', type: 'text', value: value || '', style: 'font-size:16px' });
      var cb = checkboxLabel ? h('input', { type: 'checkbox', checked: true }) : null;
      function finish(ok) {
        if (done) return;
        done = true; m.close();
        resolve(ok && input.value.trim() ? { value: input.value.trim(), checked: cb ? cb.checked : false } : null);
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); finish(true); } });
      m = modal(title, [h('label', { class: 'fe-field' }, h('span', null, label), input), cb ? h('label', { class: 'fe-check' }, cb, checkboxLabel) : null], [
        h('button', { class: 'fe-btn', type: 'button', onclick: function () { finish(false); } }, 'Cancel'),
        h('button', { class: 'fe-btn primary', type: 'button', onclick: function () { finish(true); } }, okLabel || 'OK')
      ], { onClose: function () { if (!done) { done = true; resolve(null); } } });
      setTimeout(function () { input.focus(); input.select(); }, 60);
    });
  }

  var toastTimer;
  function toast(msg, error) {
    var t = $('#fe-toast');
    t.textContent = msg;
    t.classList.toggle('error', !!error);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, error ? 6000 : 2600);
  }

  // ---------------------------------------------------------------- canvas interaction
  function onCanvasClick(e) {
    if (state.preview || state.visitor) return onLiveClick(e);
    var a = e.target.closest('a');
    if (a) e.preventDefault();
    if (e.target.closest('form')) e.preventDefault();
    var act = e.target.closest('[data-act]');
    if (act) { e.preventDefault(); e.stopPropagation(); return doAct(act.getAttribute('data-act'), act.getAttribute('data-id')); }
    var blk = e.target.closest('[data-block-id]');
    if (blk) {
      var id = blk.getAttribute('data-block-id');
      select('block', id);
      if (e.target.closest('.img-placeholder')) imageAction(blk, e.target);
      return;
    }
    var sec = e.target.closest('[data-section-id]');
    if (sec) { if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur(); return select('section', sec.getAttribute('data-section-id')); }
    if (e.target.closest('[data-site-header]')) { state.sel = null; applySelection(); state.tab = 'site'; renderInspector(); }
  }
  function imageAction(blk, target) {
    var id = blk.getAttribute('data-block-id'), type = blk.getAttribute('data-type');
    var loc = findBlock(id);
    if (!loc) return;
    if (type === 'image') pickImages({ title: 'Replace image' }, function (s) { change(function () { loc.block.src = s[0]; }); });
    else if (type === 'gallery') {
      var img = target.closest('img');
      var i = img ? parseInt(img.getAttribute('data-index'), 10) : -1;
      if (i >= 0) pickImages({ title: 'Replace photo' }, function (s) { change(function () { loc.block.images[i].src = s[0]; }); });
      else pickImages({ multiple: true, title: 'Add photos' }, function (s) { change(function () { s.forEach(function (x) { loc.block.images.push({ src: x, alt: '' }); }); }); });
    } else if (type === 'cards') {
      var card = target.closest('.card');
      var ci = $$('.card', blk).indexOf(card);
      if (ci >= 0) pickImages({ title: 'Card image' }, function (s) { change(function () { loc.block.items[ci].image = s[0]; }); });
    }
  }
  function onCanvasDblClick(e) {
    var blk = e.target.closest('[data-block-id]');
    if (!blk || e.target.closest('[data-edit]')) return;
    if (e.target.closest('img') || e.target.closest('.img-placeholder')) imageAction(blk, e.target);
  }

  function doAct(act, id) {
    var b = findBlock(id), s = findSection(id);
    switch (act) {
      case 'b-up': case 'b-down':
        return change(function () {
          var j = b.index + (act === 'b-up' ? -1 : 1);
          if (j < 0 || j >= b.col.blocks.length) return moveBlockAcrossColumns(b, act === 'b-up' ? -1 : 1);
          b.col.blocks.splice(b.index, 1); b.col.blocks.splice(j, 0, b.block);
        }, { inspector: false });
      case 'b-dup':
        return change(function () { var c = freshIds(clone(b.block)); b.col.blocks.splice(b.index + 1, 0, c); state.sel = { kind: 'block', id: c.id }; });
      case 'b-del':
        return change(function () { b.col.blocks.splice(b.index, 1); state.sel = null; });
      case 's-up': case 's-down':
        return change(function () {
          var j = s.index + (act === 's-up' ? -1 : 1);
          if (j < 0 || j >= s.list.length) return;
          s.list.splice(s.index, 1); s.list.splice(j, 0, s.section);
        }, { inspector: false });
      case 's-dup':
        return change(function () { var c = freshIds(clone(s.section)); s.list.splice(s.index + 1, 0, c); state.sel = { kind: 'section', id: c.id }; });
      case 's-del':
        return askConfirm('Delete this section?', 'This removes the whole section and everything in it. You can undo it afterwards.', 'Delete', true).then(function (ok) {
          var cur = ok && findSection(id);
          if (cur && cur.list) change(function () { cur.list.splice(cur.index, 1); state.sel = null; });
        });
      case 's-select':
        select('section', id);
        if (isPhone()) openSheet('right');
        return;
    }
  }
  // Moving past the top/bottom of a column jumps to the previous/next section.
  function moveBlockAcrossColumns(b, dir) {
    var secs = allSections(), si = secs.indexOf(b.section);
    var next = secs[si + dir];
    if (!next) return;
    b.col.blocks.splice(b.index, 1);
    var col = next.columns[0];
    if (dir < 0) col.blocks.push(b.block); else col.blocks.unshift(b.block);
  }

  // ---------------------------------------------------------------- inline text editing
  var ALLOWED = { p: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, a: 1, ul: 1, ol: 1, li: 1 };
  function sanitize(html) {
    var t = document.createElement('template');
    t.innerHTML = html;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { ch.remove(); return; }
        var tag = ch.tagName.toLowerCase();
        if (/^(script|style|iframe|object|embed|meta|link)$/.test(tag)) { ch.remove(); return; }
        if (tag === 'div' || /^h[1-6]$/.test(tag)) {
          var p = document.createElement('p');
          while (ch.firstChild) p.appendChild(ch.firstChild);
          ch.replaceWith(p); ch = p; tag = 'p';
        }
        walk(ch);
        if (!ALLOWED[tag]) { ch.replaceWith.apply(ch, Array.prototype.slice.call(ch.childNodes)); return; }
        Array.prototype.slice.call(ch.attributes).forEach(function (a) {
          if (!(tag === 'a' && (a.name === 'href' || a.name === 'target' || a.name === 'rel'))) ch.removeAttribute(a.name);
        });
        if (tag === 'a' && /^\s*(javascript|data|vbscript):/i.test(ch.getAttribute('href') || '')) ch.removeAttribute('href');
      });
    })(t.content);
    return t.innerHTML;
  }
  var inlineSession = false;
  function onInlineInput(el) {
    var blk = el.closest('[data-block-id]');
    var loc = blk && findBlock(blk.getAttribute('data-block-id'));
    if (!loc) return;
    if (!inlineSession) { pushUndo(); inlineSession = true; renderStatus(); }
    var kind = el.getAttribute('data-edit'), key = el.getAttribute('data-key'), val;
    if (kind === 'rich') val = sanitize(el.innerHTML);
    else if (kind === 'list') val = $$('li', el).map(function (li) { return li.textContent; });
    else val = el.textContent.replace(/\s+/g, ' ');
    setPath(loc.block, key, val);
    markDirty();
  }
  function onInlineBlur(el) {
    var blk = el.closest('[data-block-id]');
    var loc = blk && findBlock(blk.getAttribute('data-block-id'));
    if (loc && el.getAttribute('data-edit') === 'list') {
      var items = loc.block.items.map(function (s) { return s.trim(); }).filter(Boolean);
      loc.block.items = items.length ? items : ['List item'];
    }
    if (loc && el.getAttribute('data-edit') === 'plain') setPath(loc.block, el.getAttribute('data-key'), (getPath(loc.block, el.getAttribute('data-key')) || '').trim());
    inlineSession = false;
    if (loc && state.sel && state.sel.id === loc.block.id && /^items\./.test(el.getAttribute('data-key') || '')) renderInspector();
  }

  // Rich text formatting bar
  var fmt;
  function buildFormatBar() {
    fmt = h('div', { class: 'fe-fmt' });
    [['bold', '<b>B</b>', 'Bold (Ctrl+B)'], ['italic', '<i>I</i>', 'Italic (Ctrl+I)'], ['underline', '<u>U</u>', 'Underline'],
      ['link', '🔗', 'Add link'], ['unlink', '⛓︎̸', 'Remove link'], ['insertUnorderedList', '•', 'Bullet list'], ['removeFormat', '⌫', 'Clear formatting']].forEach(function (c) {
      fmt.appendChild(h('button', {
        type: 'button', title: c[2], html: c[1],
        onmousedown: function (e) { e.preventDefault(); },
        onclick: function () {
          var el = document.activeElement;
          if (c[0] === 'link') {
            var sel = window.getSelection();
            var range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
            askText('Add a link', 'Link to — a page like /contact/, a website https://…, mailto:email or tel:number', '', 'Add link').then(function (r) {
              if (!r || !el || !el.getAttribute('data-edit')) return;
              el.focus();
              if (range) { var s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(range); }
              document.execCommand('createLink', false, r.value);
              onInlineInput(el);
            });
            return;
          } else document.execCommand(c[0], false, null);
          if (el && el.getAttribute('data-edit')) onInlineInput(el);
        }
      }));
    });
    document.body.appendChild(fmt);
  }
  function positionFormatBar() {
    var el = document.activeElement;
    if (!el || el.getAttribute('data-edit') !== 'rich' || state.preview) { fmt.classList.remove('show'); return; }
    var r = el.getBoundingClientRect();
    var sr = stage.getBoundingClientRect();
    fmt.classList.add('show');
    fmt.style.left = Math.max(sr.left + 4, r.left) + 'px';
    fmt.style.top = Math.max(sr.top + 4, r.top - 44) + 'px';
  }

  // ---------------------------------------------------------------- inspector (right panel)
  function renderInspector() {
    var panel = $('#fe-right');
    var scroll = panel.scrollTop;
    var keepScroll = renderInspector.keep;
    renderInspector.keep = false;
    panel.innerHTML = '';
    var tabs = h('div', { class: 'fe-tabs' });
    [['selection', 'Selected'], ['page', 'Page'], ['site', 'Site']].forEach(function (t) {
      tabs.appendChild(h('button', { type: 'button', class: state.tab === t[0] ? 'on' : '', onclick: function () { state.tab = t[0]; renderInspector(); } }, t[1]));
    });
    panel.appendChild(tabs);
    var body = h('div', { class: 'fe-insp' });
    panel.appendChild(body);
    if (state.tab === 'page') pageInspector(body);
    else if (state.tab === 'site') siteInspector(body);
    else if (state.sel && state.sel.kind === 'block' && findBlock(state.sel.id)) blockInspector(body, findBlock(state.sel.id));
    else if (state.sel && state.sel.kind === 'section' && findSection(state.sel.id)) sectionInspector(body, findSection(state.sel.id));
    else body.appendChild(h('div', null,
      h('h3', null, 'Nothing selected'),
      isPhone() ? h('div', { class: 'fe-note', html: '<b>On a phone</b><br>• Tap <b>+ Add</b> below, then tap a block or section to add it.<br>• Tap something on the page, then <b>Settings</b> to change it.<br>• Hold and drag the <b>⠿</b> handle to move things, or use the ↑ ↓ buttons.' }) : null,
      h('div', { class: 'fe-note', html:
        '<b>How to edit</b><br>• <b>Click any text</b> on the page and type.<br>• <b>Click</b> a block or section to see its settings here.<br>' +
        '• <b>Drag</b> blocks and sections in from the left.<br>• Drag the <b>⠿ handle</b> to move things around.<br>' +
        '• <b>Drop photos</b> from your computer onto any image, gallery or column.<br>• <b>Double-click</b> an image to replace it.<br>• Click the <b>menu bar</b> at the top of the page to edit the logo & menu.' }),
      h('p', { class: 'fe-hint', style: 'margin:10px 0' }, 'Shortcuts: Ctrl+Z undo · Ctrl+Shift+Z redo · Ctrl+S save · Ctrl+D duplicate · Delete removes the selected block.')));
    if (keepScroll) panel.scrollTop = scroll;
  }

  // Field builders. Each edits obj[key]; text inputs batch into one undo step per focus.
  function setVal(obj, key, v, keepEmpty) {
    if ((v === '' || v == null) && !keepEmpty) delete obj[key]; else obj[key] = v;
  }
  function commitField(obj, key, v, opts) {
    opts = opts || {};
    if (!editSession) { pushUndo(); editSession = true; }
    if (opts.set) opts.set(v); else setVal(obj, key, v, opts.keepEmpty);
    markDirty();
    renderTopbar.lazy();
    if (opts.immediate) { renderCanvas(); if (opts.reinspect) { renderInspector.keep = true; renderInspector(); } }
    else scheduleCanvas();
  }
  renderTopbar.lazy = debounce(function () { if (state.tab === 'page' || renderTopbar.pagesChanged) renderTopbar(); else renderStatus(); }, 300);

  function wrap(label, input, hint) {
    return h('label', { class: 'fe-field' }, label ? h('span', null, label) : null, input, hint ? h('small', null, hint) : null);
  }
  function fText(label, obj, key, opts) {
    opts = opts || {};
    var attrs = {
      type: opts.type || 'text', value: obj[key] == null ? '' : obj[key], placeholder: opts.placeholder || '', list: opts.list || null,
      onfocus: function () { editSession = false; },
      onblur: function () { editSession = false; if (opts.onblur) opts.onblur(); }
    };
    attrs['on' + (opts.lazy ? 'change' : 'input')] = function (e) {
      var v = e.target.value;
      if (opts.type === 'number') v = v === '' ? '' : Number(v);
      commitField(obj, key, opts.transform ? opts.transform(v) : v, opts);
    };
    var input = opts.multiline ? h('textarea', attrs) : h('input', attrs);
    if (opts.multiline) input.value = obj[key] == null ? '' : obj[key];
    return wrap(label, input, opts.hint);
  }
  function fSelect(label, obj, key, options, opts) {
    opts = opts || {};
    var cur = obj[key] == null ? (opts.def != null ? opts.def : '') : String(obj[key]);
    var sel = h('select', {
      onchange: function (e) {
        editSession = false;
        var v = e.target.value;
        if (opts.number) v = v === '' ? '' : Number(v);
        commitField(obj, key, v, Object.assign({ immediate: true }, opts));
        editSession = false;
      }
    });
    options.forEach(function (o) {
      o = Array.isArray(o) ? o : [o, o];
      sel.appendChild(h('option', { value: o[0], selected: String(o[0]) === cur ? true : null }, o[1]));
    });
    return wrap(label, sel, opts.hint);
  }
  function fSeg(label, obj, key, options, opts) {
    opts = opts || {};
    var cur = obj[key] == null ? (opts.def != null ? opts.def : '') : String(obj[key]);
    var seg = h('div', { class: 'fe-seg' });
    options.forEach(function (o) {
      seg.appendChild(h('button', {
        type: 'button', class: String(o[0]) === cur ? 'on' : '', title: o[2] || o[1],
        onclick: function () {
          editSession = false;
          commitField(obj, key, o[0], Object.assign({ immediate: true, reinspect: true }, opts));
          editSession = false;
        }
      }, o[1]));
    });
    return h('div', { class: 'fe-field' }, label ? h('span', null, label) : null, seg);
  }
  function fCheck(label, obj, key, opts) {
    opts = opts || {};
    return h('label', { class: 'fe-check' }, h('input', {
      type: 'checkbox', checked: !!obj[key],
      onchange: function (e) { editSession = false; commitField(obj, key, e.target.checked ? true : '', Object.assign({ immediate: true }, opts)); editSession = false; }
    }), label);
  }
  function fColor(label, obj, key, opts) {
    opts = opts || {};
    var val = obj[key] || '';
    var text = h('input', { class: 'fe-input', type: 'text', value: val, placeholder: opts.placeholder || 'Default',
      onfocus: function () { editSession = false; },
      oninput: function (e) { var v = e.target.value.trim(); if (!v || /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/.test(v)) { if (/^#[0-9a-f]{6}$/i.test(v)) color.value = v; commitField(obj, key, v, opts); } } });
    var color = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val) ? val : (opts.fallback || '#ffffff'),
      onfocus: function () { editSession = false; },
      oninput: function (e) { text.value = e.target.value; commitField(obj, key, e.target.value, opts); } });
    var clear = opts.clearable === false ? null : h('button', { class: 'fe-btn small', type: 'button', title: 'Reset to default', style: 'flex:none',
      onclick: function () { editSession = false; text.value = ''; commitField(obj, key, '', Object.assign({ immediate: true }, opts)); editSession = false; } }, '×');
    return h('div', { class: 'fe-field' }, h('span', null, label), h('div', { class: 'fe-color' }, color, text, clear), opts.hint ? h('small', null, opts.hint) : null);
  }
  function fRange(label, obj, key, min, max, step, opts) {
    opts = opts || {};
    var cur = obj[key] == null ? opts.def : obj[key];
    var out = h('b', { style: 'font-weight:600;float:right' }, String(cur) + (opts.suffix || ''));
    var r = h('input', { type: 'range', min: min, max: max, step: step, value: cur, style: 'width:100%',
      onfocus: function () { editSession = false; }, onpointerdown: function () { editSession = false; },
      oninput: function (e) { var v = Number(e.target.value); out.textContent = v + (opts.suffix || ''); commitField(obj, key, v, opts); } });
    return h('div', { class: 'fe-field' }, h('span', null, label, out), r);
  }
  function fImage(label, obj, key, opts) {
    opts = opts || {};
    var src = obj[key];
    return h('div', { class: 'fe-field' }, label ? h('span', null, label) : null,
      h('div', { class: 'fe-imgfield' },
        src ? h('img', { src: imgUrl(src), alt: '' }) : h('div', { class: 'fe-noimg' }),
        h('div', { class: 'fe-btns' },
          h('button', { class: 'fe-btn', type: 'button', onclick: function () {
            pickImages({ title: label || 'Choose image' }, function (s) { change(function () { obj[key] = s[0]; if (opts.after) opts.after(); }); });
          } }, src ? 'Change…' : 'Choose image…'),
          src && opts.removable !== false ? h('button', { class: 'fe-btn danger', type: 'button', onclick: function () { change(function () { delete obj[key]; }); } }, 'Remove') : null)));
  }
  function linkOptions() {
    var dl = $('#fe-links');
    if (!dl) { dl = h('datalist', { id: 'fe-links' }); document.body.appendChild(dl); }
    dl.innerHTML = '';
    state.site.pages.forEach(function (p) { dl.appendChild(h('option', { value: pageUrl(p) }, p.title)); });
    allAnchors().forEach(function (a) { dl.appendChild(h('option', { value: a }, 'Section link')); });
    return 'fe-links';
  }
  function allAnchors() {
    var out = [];
    state.site.pages.forEach(function (p) { p.sections.forEach(function (s) { if (s.anchor) out.push(pageUrl(p) + '#' + s.anchor); }); });
    return out;
  }
  function fLink(label, obj, key, opts) {
    return fText(label, obj, key, Object.assign({ list: linkOptions(), placeholder: '/contact/  or  https://…', hint: 'A page on this site (pick from the list), a web address, mailto:email or tel:number.' }, opts || {}));
  }

  // Editable list of objects (cards, gallery photos, links, form fields, menu items)
  // A list of short text lines edited as one box, one item per line.
  function fLines(label, obj, key, hint) {
    var ta = h('textarea', { rows: 5,
      onfocus: function () { editSession = false; },
      onblur: function () { editSession = false; },
      oninput: function (e) {
        commitField(obj, key, e.target.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), { keepEmpty: true });
      } });
    ta.value = (obj[key] || []).join('\n');
    return wrap(label, ta, hint);
  }
  function fList(label, arr, opts) {
    var box = h('div', { class: 'fe-field' }, h('span', null, label));
    arr.forEach(function (item, i) {
      var head = h('div', { class: 'fe-listed-h' }, h('b', null, opts.title(item, i)),
        h('button', { class: 'fe-btn small', type: 'button', title: 'Move up', html: icon('up'), disabled: i === 0 ? true : null,
          onclick: function () { change(function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); }); } }),
        h('button', { class: 'fe-btn small', type: 'button', title: 'Move down', html: icon('down'), disabled: i === arr.length - 1 ? true : null,
          onclick: function () { change(function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); }); } }),
        h('button', { class: 'fe-btn small danger', type: 'button', title: 'Remove', html: icon('trash'),
          onclick: function () { change(function () { arr.splice(i, 1); }); } }));
      $$('svg', head).forEach(function (s) { s.style.width = '13px'; s.style.height = '13px'; });
      box.appendChild(h('div', { class: 'fe-listed' }, head, h('div', { class: 'fe-listed-b' }, opts.fields(item, i))));
    });
    var btns = h('div', { class: 'fe-btns' }, h('button', { class: 'fe-btn', type: 'button', onclick: function () { change(function () { arr.push(opts.make()); }); } }, '+ ' + (opts.addLabel || 'Add')));
    if (opts.extraButtons) opts.extraButtons.forEach(function (b) { btns.appendChild(b); });
    box.appendChild(btns);
    return box;
  }

  var ALIGN = [['', 'Auto', 'Follow the section'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
  var WIDTHS = [['', 'Full column'], ['300px', '300 px'], ['400px', '400 px'], ['560px', '560 px'], ['700px', '700 px'], ['900px', '900 px']];

  function blockInspector(body, loc) {
    var b = loc.block;
    var def = BLOCKS[b.type] || { label: b.type };
    var inFooter = loc.section === state.site.footer;
    body.appendChild(h('h3', null, def.label + (inFooter ? ' (footer)' : '')));
    body.appendChild(h('div', { class: 'fe-btns' },
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { doAct('b-dup', b.id); } }, 'Duplicate'),
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { select('section', loc.section.id); } }, 'Select section'),
      h('button', { class: 'fe-btn danger', type: 'button', onclick: function () { doAct('b-del', b.id); } }, 'Delete')));

    var f = [];
    switch (b.type) {
      case 'heading':
        f.push(h('div', { class: 'fe-note' }, 'Click the heading on the page to change its words.'));
        f.push(fSeg('Size', b, 'look', [[1, 'XL'], [2, 'L'], [3, 'M'], [4, 'S']], { def: String(b.level || 2), set: function (v) { b.look = Number(v); } }));
        f.push(fSelect('Heading type (for Google)', b, 'level', [[1, 'Main page heading (H1)'], [2, 'Section heading (H2)'], [3, 'Sub-heading (H3)'], [4, 'Minor heading (H4)']], {
          def: '2', reinspect: true,
          set: function (v) { var look = b.look || b.level || 2; b.level = Number(v); b.look = look; },
          hint: 'Does not change how it looks. Each page should have exactly one main heading: say what you do and where.'
        }));
        break;
      case 'text':
        f.push(h('div', { class: 'fe-note' }, 'Click the text on the page to type. Select words to make them bold, italic or a link. Press Enter for a new paragraph.'));
        f.push(fSeg('Text size', b, 'size', [['small', 'Small'], ['', 'Normal'], ['large', 'Large'], ['eyebrow', 'Label', 'Small label in normal case']], { def: '' }));
        break;
      case 'list':
        f.push(h('div', { class: 'fe-note' }, 'Click the list on the page to edit it. Press Enter for a new item.'));
        break;
      case 'button':
        f.push(fText('Button text', b, 'label', { keepEmpty: true }));
        f.push(fLink('Goes to', b, 'href'));
        f.push(fSeg('Style', b, 'variant', [['outline', 'Outline'], ['solid', 'Solid']], { def: 'outline' }));
        break;
      case 'image':
        f.push(fImage('Image', b, 'src', { removable: false }));
        f.push(fText('Description (alt text)', b, 'alt', { hint: 'Describes the photo for search engines and screen readers.', keepEmpty: true }));
        f.push(fSelect('Shape', b, 'ratio', [['auto', 'Original shape'], ['1:1', 'Square'], ['4:5', 'Portrait 4:5'], ['3:4', 'Portrait 3:4'], ['2:3', 'Tall 2:3'], ['4:3', 'Landscape 4:3'], ['3:2', 'Landscape 3:2'], ['16:9', 'Wide 16:9']], { def: 'auto' }));
        if (b.ratio && b.ratio !== 'auto') f.push(fSelect('Focus point', b, 'position', [['', 'Center'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]));
        f.push(fLink('Link (optional)', b, 'href'));
        f.push(fText('Caption (optional)', b, 'caption'));
        break;
      case 'gallery':
        f.push(fSeg('Columns', b, 'columns', [[1, '1'], [2, '2'], [3, '3'], [4, '4']], { def: '3', set: function (v) { b.columns = Number(v); } }));
        f.push(fList('Photos', b.images, {
          title: function (it, i) { return 'Photo ' + (i + 1); },
          fields: function (it) { return [fImage('', it, 'src', { removable: false }), fText('Description', it, 'alt', { keepEmpty: true })]; },
          make: function () { return { src: '', alt: '' }; },
          addLabel: 'Empty slot',
          extraButtons: [h('button', { class: 'fe-btn primary', type: 'button', onclick: function () {
            pickImages({ multiple: true, title: 'Add photos' }, function (s) { change(function () { s.forEach(function (x) { b.images.push({ src: x, alt: '' }); }); }); });
          } }, '+ Add photos…')]
        }));
        f.push(h('p', { class: 'fe-hint', style: 'margin:0' }, 'Tip: drag several photos from your computer straight onto the gallery.'));
        break;
      case 'cards':
        f.push(fSeg('Columns', b, 'columns', [[2, '2'], [3, '3'], [4, '4']], { def: '3', set: function (v) { b.columns = Number(v); } }));
        f.push(fList('Cards', b.items, {
          title: function (it, i) { return it.title || 'Card ' + (i + 1); },
          fields: function (it) { return [fImage('', it, 'image'), fText('Title', it, 'title', { keepEmpty: true }), fText('Short text', it, 'text'), fLink('Link', it, 'href')]; },
          make: function () { return { title: 'New card', image: '', href: '' }; }, addLabel: 'Add card'
        }));
        break;
      case 'links':
        f.push(fText('Title', b, 'title'));
        f.push(fList('Links', b.items, {
          title: function (it) { return it.label || 'Link'; },
          fields: function (it) { return [fText('Text', it, 'label', { keepEmpty: true }), fLink('Goes to', it, 'href')]; },
          make: function () { return { label: 'New link', href: '/' }; }, addLabel: 'Add link'
        }));
        break;
      case 'form':
        f.push(fText('Send enquiries to (email)', b, 'email', { type: 'email' }));
        f.push(fText('Email subject', b, 'subject'));
        f.push(fText('Form service address (optional)', b, 'action', { type: 'url', placeholder: 'https://formspree.io/f/…',
          hint: 'Without this, pressing Submit opens the visitor\'s email app with the message filled in. Add a free Formspree (or similar) address to receive submissions directly.' }));
        f.push(fText('Button text', b, 'submitLabel'));
        f.push(fText('Thank-you message', b, 'successMessage'));
        f.push(fList('Fields', b.fields, {
          title: function (it) { return it.label || 'Field'; },
          fields: function (it) {
            return [fText('Label', it, 'label', { keepEmpty: true, set: function (v) { it.label = v; it.name = slugify(v).replace(/-/g, '_') || 'field'; } }),
              fSelect('Type', it, 'type', [['text', 'Short text'], ['email', 'Email'], ['tel', 'Phone'], ['textarea', 'Long text'], ['number', 'Number'], ['date', 'Date']]),
              h('div', { class: 'fe-row' }, fCheck('Required', it, 'required'), fCheck('Half width', it, 'half'))];
          },
          make: function () { return { label: 'Phone', name: 'phone', type: 'tel' }; }, addLabel: 'Add field'
        }));
        break;
      case 'spacer':
        f.push(fRange('Height', b, 'height', 0, 300, 5, { def: 40, suffix: ' px' }));
        break;
      case 'embed':
        f.push(fText('Embed code (HTML)', b, 'html', { multiline: true, hint: 'Paste embed code from Google Maps, YouTube, Instagram, etc.' }));
        break;
    }
    f.forEach(function (x) { body.appendChild(x); });

    if (b.type !== 'spacer' && b.type !== 'divider') {
      body.appendChild(h('h4', null, 'Layout'));
      body.appendChild(fSeg('Alignment', b, 'align', ALIGN, { def: '' }));
      body.appendChild(fSelect('Max width', b, 'maxWidth', WIDTHS));
    }
    body.appendChild(fCheck('Hide on phones', b, 'hideMobile'));
  }

  function sectionInspector(body, loc) {
    var s = loc.section, st = s.style = s.style || {};
    body.appendChild(h('h3', null, loc.footer ? 'Footer (every page)' : 'Section'));
    if (!loc.footer) body.appendChild(h('div', { class: 'fe-btns' },
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { doAct('s-up', s.id); } }, '↑ Up'),
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { doAct('s-down', s.id); } }, '↓ Down'),
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { doAct('s-dup', s.id); } }, 'Duplicate'),
      h('button', { class: 'fe-btn danger', type: 'button', onclick: function () { doAct('s-del', s.id); } }, 'Delete')));

    body.appendChild(fSelect('Columns', s, 'layout', LAYOUT_LABELS, {
      def: s.columns.length === 1 ? '1' : '1-1', reinspect: true,
      set: function (v) {
        var n = R.LAYOUTS[v].length;
        while (s.columns.length < n) s.columns.push({ id: uid('c'), blocks: [] });
        while (s.columns.length > n) { var extra = s.columns.pop(); s.columns[s.columns.length - 1].blocks = s.columns[s.columns.length - 1].blocks.concat(extra.blocks); }
        s.layout = v;
      }
    }));
    if (s.columns.length > 1) body.appendChild(fCheck('On phones, show right column first', st, 'reverseMobile'));

    body.appendChild(h('h4', null, 'Background'));
    body.appendChild(fSeg('Colour scheme', st, 'theme', [['light', 'Stone'], ['white', 'White'], ['navy', 'Navy'], ['dark', 'Dark']], { def: 'light' }));
    body.appendChild(fColor('Custom background colour', st, 'bg', { hint: 'Leave empty to use the colour scheme.' }));
    body.appendChild(fColor('Custom text colour', st, 'textColor', { fallback: '#000000' }));
    body.appendChild(fImage('Background photo', st, 'bgImage', { after: function () { if (!st.theme || st.theme === 'light' || st.theme === 'white') st.theme = 'dark'; } }));
    if (st.bgImage) {
      body.appendChild(fRange('Darken photo', st, 'overlay', 0, 0.9, 0.05, { def: 0.35 }));
      body.appendChild(fSelect('Photo focus', st, 'bgPosition', [['', 'Center'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]));
    }

    body.appendChild(h('h4', null, 'Size & alignment'));
    body.appendChild(fSelect('Height', st, 'minHeight', [['', 'Fit content'], ['50vh', 'Half screen'], ['75vh', 'Three-quarter screen'], ['100vh', 'Full screen']]));
    body.appendChild(fSelect('Spacing (top & bottom)', st, 'padding', [['', 'Normal'], ['0px', 'None'], ['20px', 'Small'], ['50px', 'Medium'], ['120px', 'Large'], ['180px', 'Extra large']]));
    body.appendChild(fSelect('Content width', st, 'width', [['', 'Normal'], ['narrow', 'Narrow'], ['full', 'Edge to edge']]));
    body.appendChild(fSeg('Text alignment', st, 'align', [['', 'Left'], ['center', 'Center'], ['right', 'Right']], { def: '' }));
    if (s.columns.length > 1) body.appendChild(fSeg('Vertical alignment', st, 'valign', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], { def: 'top' }));
    if (!loc.footer) {
      body.appendChild(h('h4', null, 'Advanced'));
      body.appendChild(fText('Section link name', s, 'anchor', {
        lazy: true, transform: slugify, placeholder: 'e.g. services',
        hint: s.anchor ? 'Link to this section with: ' + pageUrl(page()) + '#' + s.anchor : 'Lets buttons and menu items jump straight to this section.'
      }));
    }
  }

  function pageInspector(body) {
    var p = page();
    var isHome = !p.slug;
    body.appendChild(h('h3', null, 'Page settings'));
    body.appendChild(fText('Page name', p, 'title', { keepEmpty: true, hint: 'Shown in the editor\'s page list.', onblur: renderTopbar }));
    var defaultTitle = p.fullTitle ? p.title : p.title + (state.site.settings.titleSuffix || '');
    body.appendChild(fText('Google title', p, 'seoTitle', { placeholder: defaultTitle,
      hint: 'The blue link Google shows, and the browser-tab name. Best: what you do + where + your name, under about 60 characters.' }));
    var mains = 0;
    p.sections.forEach(function (s) { s.columns.forEach(function (c) { c.blocks.forEach(function (b) { if (b.type === 'heading' && (parseInt(b.level, 10) || 2) === 1) mains++; }); }); });
    if (mains !== 1) body.appendChild(h('div', { class: 'fe-note' }, mains === 0
      ? 'Tip for Google: this page has no main heading. Select its most important heading and set "Heading type" to Main page heading.'
      : 'Tip for Google: this page has ' + mains + ' main headings. Keep one as "Main page heading" and set the others to "Section heading" (they will look the same).'));
    if (isHome) body.appendChild(h('div', { class: 'fe-field' }, h('span', null, 'Address'), h('div', null, '/ (home page)')));
    else body.appendChild(fText('Address', p, 'slug', {
      lazy: true, hint: 'The page lives at ' + pageUrl(p),
      set: function (v) {
        var clean = String(v).toLowerCase().split('/').map(slugify).filter(Boolean).join('/');
        if (!clean || state.site.pages.some(function (o) { return o !== p && o.slug === clean; })) { toast('That address is empty or already used', true); return; }
        var oldUrl = pageUrl(p);
        p.slug = clean;
        relink(oldUrl, pageUrl(p));
        addRedirect(oldUrl, pageUrl(p));
      }, immediate: true, reinspect: true
    }));
    body.appendChild(fText('Search engine description', p, 'description', { multiline: true, hint: 'One or two sentences shown by Google under the page title.' }));
    body.appendChild(fCheck('Transparent menu bar over the first section', p, 'headerOverlay', { hint: '' }));
    body.appendChild(fCheck('Use page name as the whole browser-tab title', p, 'fullTitle'));
    var inNav = state.site.nav.some(function (l) { return l.href === pageUrl(p); });
    body.appendChild(h('div', { class: 'fe-btns' },
      inNav ? null : h('button', { class: 'fe-btn', type: 'button', onclick: function () { change(function () { state.site.nav.push({ label: p.title, href: pageUrl(p) }); }); toast('Added to the menu'); } }, '+ Add to menu'),
      h('button', { class: 'fe-btn', type: 'button', onclick: duplicatePage }, 'Duplicate page'),
      isHome ? null : h('button', { class: 'fe-btn danger', type: 'button', onclick: deletePage }, 'Delete page')));
    body.appendChild(h('hr', { class: 'fe-sep' }));
    body.appendChild(h('h4', null, 'All pages'));
    state.site.pages.forEach(function (o) {
      body.appendChild(h('div', { class: 'fe-row', style: 'margin:4px 0' },
        h('button', { class: 'fe-btn' + (o === p ? ' primary' : ''), type: 'button', style: 'justify-content:flex-start', onclick: function () { state.tab = 'page'; goToPage(o.id); } },
          (o.slug ? o.title : 'Home') + '  ' + pageUrl(o))));
    });
    body.appendChild(h('div', { class: 'fe-btns' }, h('button', { class: 'fe-btn primary', type: 'button', onclick: addPage }, '+ New page')));
  }
  // Keeps old addresses working (and Google rankings intact) after a page moves or is deleted.
  function addRedirect(from, to) {
    var list = (state.site.redirects || []).filter(function (r) { return r.from !== from; });
    list.forEach(function (r) { if (r.to === from) r.to = to; });
    if (from !== to && from !== '/') list.push({ from: from, to: to });
    state.site.redirects = list;
  }
  function relink(oldUrl, newUrl) {
    (function walk(o) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        if ((k === 'href') && typeof o[k] === 'string' && (o[k] === oldUrl || o[k].indexOf(oldUrl + '#') === 0)) o[k] = newUrl + o[k].slice(oldUrl.length);
        else if (typeof o[k] === 'object') walk(o[k]);
      });
    })(state.site);
  }
  function addPage() {
    askText('New page', 'Page name (e.g. "Services")', '', 'Create page', 'Add it to the menu').then(function (r) {
      if (r) createPage(r.value, r.checked);
    });
  }
  function createPage(name, addNav) {
    var slug = slugify(name) || 'page', base = slug, n = 1;
    while (state.site.pages.some(function (p) { return p.slug === slug; })) slug = base + '-' + (++n);
    var p = { id: uid('p'), slug: slug, title: name, description: '', sections: [] };
    var s = newSection(SECTIONS.filter(function (t) { return t.key === 'text'; })[0]);
    s.columns[0].blocks[0].level = 1;
    s.columns[0].blocks[0].text = name;
    p.sections.push(s);
    change(function () {
      state.site.pages.push(p);
      if (addNav) state.site.nav.push({ label: name, href: pageUrl(p) });
    });
    goToPage(p.id);
  }
  function duplicatePage() {
    var p = page(), c = freshIds(clone(p));
    var slug = (p.slug || 'home') + '-copy', base = slug, n = 1;
    while (state.site.pages.some(function (o) { return o.slug === slug; })) slug = base + '-' + (++n);
    c.slug = slug; c.title = (p.slug ? p.title : 'Home') + ' (copy)'; c.fullTitle = false;
    change(function () { state.site.pages.push(c); });
    goToPage(c.id);
  }
  function deletePage() {
    var p = page();
    askConfirm('Delete page?', 'Delete the page "' + p.title + '"? You can undo this afterwards.', 'Delete page', true).then(function (ok) {
      if (ok) removePage(p);
    });
  }
  function removePage(p) {
    var url = pageUrl(p);
    change(function () {
      state.site.pages.splice(state.site.pages.indexOf(p), 1);
      state.site.nav = state.site.nav.filter(function (l) { return l.href !== url; });
      addRedirect(url, '/');
    });
    goToPage(state.site.pages[0].id);
  }

  function siteInspector(body) {
    var s = state.site.settings, t = s.theme;
    body.appendChild(h('h3', null, 'Site settings'));
    body.appendChild(h('p', { class: 'fe-hint', style: 'margin:0 0 6px' }, 'These apply to every page.'));

    body.appendChild(h('h4', null, 'Menu'));
    body.appendChild(fImage('Logo', s, 'logo', { removable: false }));
    body.appendChild(fList('Menu links', state.site.nav, {
      title: function (it) { return it.label || 'Link'; },
      fields: function (it) { return [fText('Text', it, 'label', { keepEmpty: true }), fLink('Goes to', it, 'href')]; },
      make: function () { return { label: 'New link', href: '/' }; }, addLabel: 'Add menu link'
    }));
    s.headerButton = s.headerButton || {};
    body.appendChild(fText('Menu button text (optional)', s.headerButton, 'label', { placeholder: 'e.g. Get a Quote' }));
    body.appendChild(fLink('Menu button link', s.headerButton, 'href'));

    var biz = state.site.business = state.site.business || {};
    body.appendChild(h('h4', null, 'For Google & AI assistants'));
    body.appendChild(h('p', { class: 'fe-hint', style: 'margin:0 0 6px' }, 'Added invisibly to every page so Google and AI tools know exactly what you do and where. Keep it the same as your Google Business Profile.'));
    body.appendChild(fText('Short description', biz, 'description', { multiline: true }));
    body.appendChild(fText('Phone', biz, 'phone', { placeholder: '+1-778-…' }));
    body.appendChild(fText('Email', biz, 'email', { type: 'email' }));
    body.appendChild(fText('Based in (city)', biz, 'city'));
    body.appendChild(fLines('Services (one per line)', biz, 'services', 'Use the words customers search for, e.g. "Custom Bathroom Vanities".'));
    body.appendChild(fLines('Areas you serve (one per line)', biz, 'areas'));

    body.appendChild(h('h4', null, 'Business details'));
    body.appendChild(fText('Business name', s, 'siteName', { keepEmpty: true }));
    body.appendChild(fText('Browser-tab title ending', s, 'titleSuffix', { hint: 'Added after each page name, e.g. "About | FSS Solutions".' }));
    body.appendChild(fText('Facebook page', s, 'facebook', { type: 'url' }));
    body.appendChild(fText('Instagram page', s, 'instagram', { type: 'url' }));
    body.appendChild(fText('Copyright line', s, 'copyright', { hint: '{year} is replaced with the current year.' }));
    body.appendChild(fText('Website address', s, 'siteUrl', { type: 'url', hint: 'Used for Google (sitemap & sharing previews).' }));

    body.appendChild(h('h4', null, 'Colours'));
    body.appendChild(fColor('Stone background', t, 'light', { fallback: '#e0e0db' }));
    body.appendChild(fColor('White background', t, 'white', { fallback: '#ffffff' }));
    body.appendChild(fColor('Navy background', t, 'navy', { fallback: '#253551' }));
    body.appendChild(fColor('Dark background', t, 'dark', { fallback: '#111111' }));
    body.appendChild(fColor('Text', t, 'text', { fallback: '#000000' }));
    body.appendChild(fColor('Buttons & links', t, 'accent', { fallback: '#253551' }));

    body.appendChild(h('h4', null, 'Fonts'));
    var fonts = Object.keys(R.FONTS);
    body.appendChild(fSelect('Headings', t, 'headingFont', fonts, { def: 'Montserrat' }));
    body.appendChild(fSelect('Body text', t, 'bodyFont', fonts, { def: 'Montserrat' }));
    body.appendChild(fSelect('Buttons', t, 'buttonFont', fonts, { def: 'Poppins' }));
    body.appendChild(h('label', { class: 'fe-check' }, h('input', {
      type: 'checkbox', checked: t.uppercase !== false,
      onchange: function (e) { editSession = false; commitField(t, 'uppercase', e.target.checked, { immediate: true, keepEmpty: true }); editSession = false; }
    }), 'ALL-CAPS text style'));

    body.appendChild(h('h4', null, 'Backup'));
    var importInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: function () {
      var f = importInput.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var data = JSON.parse(txt);
        if (!data.pages) throw new Error('Not a site content file');
        change(function () { state.site = ensureIds(data); state.pageId = state.site.pages[0].id; state.sel = null; });
        toast('Imported — press Save to keep it');
      }).catch(function (e) { toast('Import failed: ' + e.message, true); });
    } });
    if (DEMO) {
      body.appendChild(h('p', { class: 'fe-hint', style: 'margin:0' }, 'This is a test copy: changes are only kept on this device and never touch your real website.'));
      body.appendChild(h('div', { class: 'fe-btns' }, h('button', { class: 'fe-btn danger', type: 'button', onclick: resetDemo }, 'Start the test over')));
      return;
    }
    body.appendChild(h('div', { class: 'fe-btns' },
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { download('content.json', JSON.stringify(state.site, null, 2)); } }, 'Download backup'),
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { importInput.click(); } }, 'Restore from file…'), importInput,
      h('button', { class: 'fe-btn danger', type: 'button', onclick: discardChanges }, 'Discard unsaved changes')));
    body.appendChild(h('p', { class: 'fe-hint', style: 'margin:0' }, state.mode === 'cloud'
      ? 'Every Publish is saved in GitHub, so any earlier version can be brought back.'
      : state.server ? 'Every save also keeps the previous version in the .backups folder.'
      : 'Running without the editing server: Save downloads content.json for you to put in the website folder.'));
    if (state.passwordRequired) body.appendChild(h('div', { class: 'fe-btns' },
      h('button', { class: 'fe-btn', type: 'button', onclick: function () { forgetPassword(); location.reload(); } }, 'Sign out')));
  }

  function discardChanges() {
    askConfirm('Discard changes?', 'Throw away everything you changed since you last published?', 'Discard', true).then(function (ok) {
      if (!ok) return;
      pushUndo();
      state.site = ensureIds(JSON.parse(state.savedJson));
      afterHistory();
    });
  }
  function resetDemo() {
    askConfirm('Start the test over?', 'This puts the test copy back to the original website.', 'Start over', true).then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(DEMO_PUBLISHED_KEY); localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
      state.site = ensureIds(clone(CFG.content));
      state.savedJson = JSON.stringify(state.site);
      state.undo = []; state.redo = []; state.sel = null;
      state.pageId = state.site.pages[0].id;
      markDirty();
      renderAll();
      toast('Back to the original website');
    });
  }

  // ---------------------------------------------------------------- save / load
  function download(name, text) {
    var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1]); };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }
  var saving = false;
  function save() {
    if (saving) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var json = JSON.stringify(state.site, null, 2);
    if (DEMO) {
      state.savedJson = JSON.stringify(state.site);
      try { localStorage.setItem(DEMO_PUBLISHED_KEY, state.savedJson); } catch (e) { /* storage full: kept until the page closes */ }
      markDirty();
      setVisitor(true);
      toast('Published (test copy). This is how visitors would see it.');
      return;
    }
    if (!state.server) {
      download('content.json', json);
      state.savedJson = JSON.stringify(state.site);
      markDirty();
      toast('Downloaded content.json — copy it into the website folder, then run "node build.js".');
      return;
    }
    saving = true;
    var btn = $('[data-top="save"]');
    if (btn) btn.textContent = 'Publishing…';
    var compact = JSON.stringify(state.site);
    var paths = Object.keys(state.pending).filter(function (p) { return compact.indexOf('"' + p + '"') >= 0; });
    Promise.all(paths.map(function (p) { return blobToBase64(state.pending[p]).then(function (d) { return { path: p, data: d }; }); }))
      .then(function (files) {
        return fetch('/api/save', { method: 'POST', body: JSON.stringify({ content: state.site, files: files }), headers: authHeaders({ 'Content-Type': 'application/json' }) })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              if (r.status === 401) { forgetPassword(); return login('Please sign in again.').then(function () { return 'retry'; }); }
              if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
              paths.forEach(function (p) { delete state.pending[p]; });
              state.savedJson = compact;
              markDirty();
              toast(state.mode === 'cloud' ? 'Published! Your live website updates in about a minute.' : 'Saved. The website in dist/ has been rebuilt.');
            });
          });
      })
      .catch(function (e) { toast('Publish failed: ' + e.message, true); })
      .then(function (result) {
        saving = false;
        var b = $('[data-top="save"]'); if (b) b.textContent = 'Publish';
        if (result === 'retry') save();
      });
  }

  function boot() {
    stage = $('#fe-stage');
    root = $('#site-root');
    ghost = h('div', { class: 'fe-ghost', style: 'display:none' });
    indicator = h('div', { class: 'fe-indicator' });
    document.body.appendChild(ghost);
    document.body.appendChild(indicator);
    buildFormatBar();
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* older browsers */ }

    root.addEventListener('click', onCanvasClick);
    root.addEventListener('dblclick', onCanvasDblClick);
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      if (state.preview || state.visitor) toast('Preview only: on the live website this sends the message.');
    });
    document.body.appendChild(h('div', { id: 'fe-visit-bar' },
      h('span', null, DEMO ? 'Test copy · changes stay on this device' : 'Preview'),
      h('button', { type: 'button', onclick: function () { setVisitor(false); } }, '✎ Edit')));
    root.addEventListener('dragstart', function (e) { e.preventDefault(); });
    root.addEventListener('input', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-edit')) onInlineInput(e.target); });
    root.addEventListener('focusin', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-edit')) { inlineSession = false; positionFormatBar(); } });
    root.addEventListener('focusout', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-edit')) { onInlineBlur(e.target); setTimeout(positionFormatBar, 0); } });
    root.addEventListener('keydown', function (e) {
      var el = e.target;
      if (!el.getAttribute || !el.getAttribute('data-edit')) return;
      if (e.key === 'Enter' && el.getAttribute('data-edit') === 'plain') { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') el.blur();
    });
    root.addEventListener('paste', function (e) {
      var el = e.target.closest && e.target.closest('[data-edit]');
      if (!el) return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (el.getAttribute('data-edit') === 'plain') text = text.replace(/\s+/g, ' ');
      document.execCommand('insertText', false, text);
    });
    stage.addEventListener('scroll', positionFormatBar);
    document.addEventListener('selectionchange', positionFormatBar);

    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      var t = e.target;
      var typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if (mod && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test(t.tagName)) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !/^(INPUT|TEXTAREA)$/.test(t.tagName)) { e.preventDefault(); redo(); return; }
      if (typing || $('.fe-modal-back') || state.visitor) return;
      if (e.key === 'Escape') { if (drag) cleanupDrag(); else select(null); }
      if (!state.sel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); doAct(state.sel.kind === 'block' ? 'b-del' : 's-del', state.sel.id); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); doAct(state.sel.kind === 'block' ? 'b-dup' : 's-dup', state.sel.id); }
    });
    window.addEventListener('beforeunload', function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

    (DEMO ? Promise.resolve(null) : ping()).then(function (p) {
      state.server = !!(p && p.ok);
      state.mode = p && p.mode;
      state.passwordRequired = !!(p && p.passwordRequired);
      if (p && p.configured === false) throw new Error('The online editor is not set up yet: add EDITOR_PASSWORD and GITHUB_TOKEN in Cloudflare (see README).');
      if (state.server && state.passwordRequired && !p.authorized) return login();
    }).then(function () {
      if (DEMO) {
        var stored = null;
        try { stored = JSON.parse(localStorage.getItem(DEMO_PUBLISHED_KEY) || 'null'); } catch (e) { /* ignore */ }
        return stored || clone(CFG.content);
      }
      var url = state.server ? '/api/content' : '/content.json';
      return fetch(url, { cache: 'no-store', headers: authHeaders() }).then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'content.json not found'); });
        return r.json();
      });
    }).then(function (content) {
      state.site = ensureIds(content);
      state.savedJson = JSON.stringify(state.site);
      var draft = null;
      try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { /* ignore */ }
      if (!draft || !draft.json || draft.json === state.savedJson) return;
      if (DEMO) { state.site = ensureIds(JSON.parse(draft.json)); return; }
      return askConfirm('Restore unpublished changes?', 'You have changes from ' + new Date(draft.at).toLocaleString() + ' that were never published.', 'Restore').then(function (ok) {
        if (ok) state.site = ensureIds(JSON.parse(draft.json));
        else { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }
      });
    }).then(function () {
      var m = DEMO ? null : location.hash.match(/page=([^&]+)/);
      state.pageId = m && state.site.pages.some(function (p) { return p.id === decodeURIComponent(m[1]); }) ? decodeURIComponent(m[1]) : state.site.pages[0].id;
      state.dirty = JSON.stringify(state.site) !== state.savedJson;
      if (DEMO) state.visitor = true;
      renderAll();
      if (!state.server && !DEMO) toast('Editing offline — Save will download content.json. Run "node server.js" to save directly.');
    }).catch(function (e) {
      root.innerHTML = '<div style="padding:60px;font-family:system-ui">Could not load the site content: ' + esc(e.message) + '<br>Start the editor with <code>node server.js</code> and open <code>http://localhost:8080/editor</code>.</div>';
    });
  }
  boot();
})();
