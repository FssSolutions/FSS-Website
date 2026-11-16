/*
 * FSS Solutions site renderer.
 * Turns content.json into HTML. Shared by the live site (browser), the
 * visual editor (browser, with edit=true) and the static build (Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FSSRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  // Turn "/about" into a link that works from the current output location.
  function href(url, ctx) {
    if (!url) return '#';
    if (ctx && ctx.linkPrefix && url.charAt(0) === '/' && url.charAt(1) !== '/') {
      return ctx.linkPrefix + url.slice(1);
    }
    return url;
  }
  function asset(src, ctx) {
    if (!src) return '';
    if (/^(https?:|data:|blob:|\/\/)/.test(src)) return src;
    return (ctx && ctx.assetPrefix != null ? ctx.assetPrefix : '/') + src.replace(/^\//, '');
  }
  function isExternal(url) { return /^https?:\/\//.test(url || ''); }
  function target(url) { return isExternal(url) ? ' target="_blank" rel="noopener"' : ''; }

  // Attributes that make a piece of text editable in the editor.
  function ed(ctx, key, kind) {
    if (!ctx.edit) return '';
    return ' data-key="' + esc(key) + '" data-edit="' + (kind || 'plain') + '"';
  }

  var ICONS = {
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM21 8.1c-.1-1.5-.4-2.8-1.5-3.9S17.1 2.8 15.6 2.7C14.1 2.6 9.9 2.6 8.4 2.7 6.9 2.8 5.6 3.1 4.5 4.2S3.1 6.6 3 8.1C2.9 9.6 2.9 14.4 3 15.9c.1 1.5.4 2.8 1.5 3.9s2.4 1.4 3.9 1.5c1.5.1 5.7.1 7.2 0 1.5-.1 2.8-.4 3.9-1.5s1.4-2.4 1.5-3.9c.1-1.5.1-6.3 0-7.8zm-2 9.9a3 3 0 0 1-1.7 1.7c-1.2.5-3.9.4-5.3.4s-4.1.1-5.3-.4A3 3 0 0 1 5 18c-.5-1.2-.4-3.9-.4-5.3S4.5 8.6 5 7.4A3 3 0 0 1 6.7 5.7c1.2-.5 3.9-.4 5.3-.4s4.1-.1 5.3.4A3 3 0 0 1 19 7.4c.5 1.2.4 3.9.4 5.3s.1 4.1-.4 5.3z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M3 7h18M3 12h18M3 17h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M5 5l14 14M19 5L5 19"/></svg>'
  };

  // ---------- Layout presets ----------
  var LAYOUTS = {
    '1': [1],
    '1-1': [1, 1],
    '3-2': [3, 2],
    '2-3': [2, 3],
    '2-1': [2, 1],
    '1-2': [1, 2],
    '1-1-1': [1, 1, 1],
    '1-1-1-1': [1, 1, 1, 1]
  };

  // <img> with responsive WebP copies, real dimensions and lazy loading when the
  // build knows about the file (ctx.images, filled in by build.js).
  function imgTag(src, alt, ctx, opts) {
    opts = opts || {};
    var info = ctx.images && ctx.images[String(src || '').replace(/^\//, '')];
    var a = '<img src="' + esc(asset(src, ctx)) + '" alt="' + esc(alt) + '"';
    if (info && info.variants && info.variants.length) {
      a += ' srcset="' + esc(info.variants.map(function (v) { return asset(v.src, ctx) + ' ' + v.w + 'w'; }).join(', ')) + '"' +
        ' sizes="' + esc(opts.sizes || '100vw') + '"';
    }
    if (info && info.w && info.h) a += ' width="' + info.w + '" height="' + info.h + '"';
    if (opts.priority) a += ' fetchpriority="high"';
    else if (!ctx.first) a += ' loading="lazy"';
    a += ' decoding="async"';
    if (opts.style) a += ' style="' + esc(opts.style) + '"';
    return a + (opts.attrs || '') + '>';
  }
  // The "sizes" hint: how wide the photo shows on phones and on larger screens.
  function sizesFor(ctx, desktopShare, phoneShare, maxWidth) {
    var share = (ctx.colShare || 1) * (desktopShare || 1);
    var desk = /^\d+px$/.test(maxWidth || '') ? maxWidth : Math.max(10, Math.round(share * 100)) + 'vw';
    return '(max-width: 800px) ' + Math.round((phoneShare || 1) * 100) + 'vw, ' + desk;
  }

  // ---------- Blocks ----------
  var BLOCKS = {
    heading: function (b, ctx) {
      var lvl = Math.min(4, Math.max(1, parseInt(b.level, 10) || 2));
      var look = Math.min(4, Math.max(1, parseInt(b.look, 10) || lvl));
      return '<h' + lvl + ' class="b-heading' + (look !== lvl ? ' look-' + look : '') + '"' + ed(ctx, 'text', 'plain') + '>' + esc(b.text) + '</h' + lvl + '>';
    },
    text: function (b, ctx) {
      return '<div class="b-text' + (b.size ? ' size-' + esc(b.size) : '') + '"' + ed(ctx, 'html', 'rich') + '>' + (b.html || '') + '</div>';
    },
    list: function (b, ctx) {
      var items = (b.items || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<ul class="b-list"' + ed(ctx, 'items', 'list') + '>' + (items || '<li></li>') + '</ul>';
    },
    button: function (b, ctx) {
      var tag = ctx.edit ? 'span' : 'a';
      var attrs = ctx.edit ? '' : ' href="' + esc(href(b.href, ctx)) + '"' + target(b.href);
      return '<div class="b-button"><' + tag + ' class="btn btn-' + esc(b.variant || 'outline') + '"' + attrs + ed(ctx, 'label', 'plain') + '>' + esc(b.label) + '</' + tag + '></div>';
    },
    image: function (b, ctx) {
      var ratio = b.ratio && b.ratio !== 'auto' ? ' style="aspect-ratio:' + esc(b.ratio.replace(':', '/')) + '"' : '';
      var img = b.src
        ? imgTag(b.src, b.alt, ctx, { sizes: sizesFor(ctx, 1, 1, b.maxWidth), style: b.position ? 'object-position:' + b.position : '' })
        : '<div class="img-placeholder">Drop an image here</div>';
      var inner = '<div class="img-frame' + (ratio ? ' fixed' : '') + '"' + ratio + '>' + img + '</div>';
      if (b.caption || ctx.edit && b.caption !== undefined) inner += '<figcaption' + ed(ctx, 'caption') + '>' + esc(b.caption) + '</figcaption>';
      if (b.href && !ctx.edit) inner = '<a href="' + esc(href(b.href, ctx)) + '"' + target(b.href) + '>' + inner + '</a>';
      return '<figure class="b-image">' + inner + '</figure>';
    },
    gallery: function (b, ctx) {
      var cols = parseInt(b.columns, 10) || 3;
      var imgs = (b.images || []).map(function (im, i) {
        return '<figure class="g-item">' + imgTag(im.src, im.alt, ctx, { sizes: sizesFor(ctx, 1 / cols, 1 / Math.min(cols, 2)),
          attrs: ' data-full="' + esc(asset(im.src, ctx)) + '" data-index="' + i + '"' }) + '</figure>';
      }).join('');
      if (!imgs && ctx.edit) imgs = '<div class="img-placeholder">Drop images here</div>';
      return '<div class="b-gallery" style="--cols:' + cols + '">' + imgs + '</div>';
    },
    cards: function (b, ctx) {
      var cols = parseInt(b.columns, 10) || 3;
      var items = (b.items || []).map(function (it, i) {
        var tag = ctx.edit || !it.href ? 'div' : 'a';
        var link = tag === 'a' ? ' href="' + esc(href(it.href, ctx)) + '"' + target(it.href) : '';
        return '<' + tag + ' class="card"' + link + '>' +
          '<div class="card-img">' + (it.image ? imgTag(it.image, it.alt || it.title, ctx, { sizes: sizesFor(ctx, 1 / cols, 1 / Math.min(cols, 2)) }) : '<div class="img-placeholder">Image</div>') + '</div>' +
          '<h3 class="card-title"' + ed(ctx, 'items.' + i + '.title') + '>' + esc(it.title) + '</h3>' +
          (it.text || ctx.edit ? '<p class="card-text"' + ed(ctx, 'items.' + i + '.text') + '>' + esc(it.text) + '</p>' : '') +
          '</' + tag + '>';
      }).join('');
      return '<div class="b-cards" style="--cols:' + cols + '">' + items + '</div>';
    },
    spacer: function (b) {
      return '<div class="b-spacer" style="height:' + (parseInt(b.height, 10) || 40) + 'px"></div>';
    },
    divider: function () { return '<hr class="b-divider">'; },
    form: function (b, ctx) {
      var fields = (b.fields || []).map(function (f, i) {
        var name = esc(f.name || ('field' + i));
        var req = f.required ? ' required' : '';
        var label = '<span class="f-label">' + esc(f.label) + (f.required ? ' <em>(required)</em>' : '') + '</span>';
        var input = f.type === 'textarea'
          ? '<textarea name="' + name + '" rows="4"' + req + '></textarea>'
          : '<input type="' + esc(f.type || 'text') + '" name="' + name + '"' + req + '>';
        return '<label class="f-field' + (f.half ? ' half' : '') + '">' + label + input + '</label>';
      }).join('');
      return '<form class="b-form" data-action="' + esc(b.action) + '" data-email="' + esc(b.email) + '" data-subject="' + esc(b.subject) + '" data-success="' + esc(b.successMessage || 'Thank you!') + '"' + (ctx.edit ? ' onsubmit="return false"' : '') + '>' +
        fields +
        '<div class="f-actions"><button type="submit" class="btn btn-outline"' + ed(ctx, 'submitLabel') + '>' + esc(b.submitLabel || 'Submit') + '</button></div>' +
        '<p class="f-status" role="status"></p></form>';
    },
    links: function (b, ctx) {
      var items = (b.items || []).map(function (l) {
        return '<li><a href="' + esc(href(l.href, ctx)) + '"' + target(l.href) + (ctx.edit ? ' onclick="return false"' : '') + '>' + esc(l.label) + '</a></li>';
      }).join('');
      return '<div class="b-links">' + (b.title || ctx.edit ? '<p class="links-title"' + ed(ctx, 'title') + '>' + esc(b.title) + '</p>' : '') + '<ul>' + items + '</ul></div>';
    },
    embed: function (b, ctx) {
      if (ctx.edit) return '<div class="b-embed edit-embed"><div class="embed-label">Embed / HTML — edit in the settings panel</div>' + (b.html || '') + '</div>';
      return '<div class="b-embed">' + (b.html || '') + '</div>';
    }
  };

  function renderBlock(b, ctx) {
    var fn = BLOCKS[b.type];
    var html = fn ? fn(b, ctx) : '<!-- unknown block ' + esc(b.type) + ' -->';
    var cls = 'block block-' + esc(b.type) + (b.align ? ' align-' + esc(b.align) : '') + (b.hideMobile ? ' hide-mobile' : '');
    var style = b.maxWidth ? ' style="max-width:' + esc(b.maxWidth) + '"' : '';
    var data = ctx.edit ? ' data-block-id="' + esc(b.id) + '" data-type="' + esc(b.type) + '"' : '';
    return '<div class="' + cls + '"' + style + data + '>' + html + '</div>';
  }

  function sectionStyle(s, ctx) {
    var st = s.style || {};
    var css = [];
    if (st.bg) css.push('--sec-bg:' + st.bg);
    if (st.textColor) css.push('--sec-fg:' + st.textColor);
    if (st.minHeight) css.push('min-height:' + st.minHeight);
    if (st.padding) css.push('--sec-pad:' + st.padding);
    if (st.gap) css.push('--sec-gap:' + st.gap);
    return css.length ? ' style="' + esc(css.join(';')) + '"' : '';
  }

  function renderSection(s, ctx) {
    var st = s.style || {};
    var cls = ['section', 'theme-' + (st.theme || 'light')];
    if (st.bgImage) cls.push('has-bg');
    if (st.align) cls.push('text-' + st.align);
    if (st.valign) cls.push('valign-' + st.valign);
    if (st.width) cls.push('width-' + st.width);
    if (st.reverseMobile) cls.push('reverse-mobile');
    var cols = s.columns || [];
    var widths = (LAYOUTS[s.layout] || cols.map(function () { return 1; }));
    var grid = widths.slice(0, cols.length).map(function (w) { return w + 'fr'; }).join(' ');
    var bg = '';
    if (st.bgImage) {
      bg = '<div class="sec-bg">' + imgTag(st.bgImage, st.bgAlt || '', ctx, { sizes: '100vw', priority: ctx.first, style: st.bgPosition ? 'object-position:' + st.bgPosition : '' }) +
        '<div class="sec-overlay" style="opacity:' + (st.overlay != null ? st.overlay : 0.35) + '"></div></div>';
    }
    var total = widths.slice(0, cols.length).reduce(function (a, b) { return a + b; }, 0) || 1;
    var colsHtml = cols.map(function (c, ci) {
      var cctx = Object.assign({}, ctx, { colShare: (widths[ci] || 1) / total });
      var blocks = (c.blocks || []).map(function (b) { return renderBlock(b, cctx); }).join('');
      var data = ctx.edit ? ' data-col-id="' + esc(c.id) + '"' : '';
      var empty = ctx.edit && !(c.blocks || []).length ? '<div class="col-empty">Drag blocks here</div>' : '';
      return '<div class="col"' + data + '>' + blocks + empty + '</div>';
    }).join('');
    var data = ctx.edit ? ' data-section-id="' + esc(s.id) + '"' : '';
    var id = s.anchor ? ' id="' + esc(s.anchor) + '"' : '';
    return '<section class="' + cls.join(' ') + '"' + id + data + sectionStyle(s, ctx) + '>' + bg +
      '<div class="sec-inner"><div class="sec-grid" style="grid-template-columns:' + grid + '">' + colsHtml + '</div></div></section>';
  }

  function pageUrl(page) { return '/' + (page.slug ? page.slug.replace(/^\/|\/$/g, '') + '/' : ''); }
  function isActive(link, page) {
    var h = (link.href || '').replace(/#.*$/, '').replace(/\/$/, '');
    var p = ('/' + (page.slug || '')).replace(/\/$/, '');
    return h === p && !/#/.test(link.href || '');
  }

  function renderHeader(site, page, ctx) {
    var s = site.settings || {};
    var navLinks = (site.nav || []).map(function (l) {
      var active = isActive(l, page) ? ' class="active"' : '';
      return '<a href="' + esc(href(l.href, ctx)) + '"' + active + target(l.href) + '>' + esc(l.label) + '</a>';
    }).join('');
    var social = '';
    if (s.facebook) social += '<a class="icon" href="' + esc(s.facebook) + '" target="_blank" rel="noopener" aria-label="Facebook">' + ICONS.facebook + '</a>';
    if (s.instagram) social += '<a class="icon" href="' + esc(s.instagram) + '" target="_blank" rel="noopener" aria-label="Instagram">' + ICONS.instagram + '</a>';
    var cta = s.headerButton && s.headerButton.label ? '<a class="btn btn-outline header-cta" href="' + esc(href(s.headerButton.href, ctx)) + '">' + esc(s.headerButton.label) + '</a>' : '';
    var first = (page.sections || [])[0];
    var tone = page.headerOverlay ? ' overlay' : ' on-' + ((first && first.style && first.style.theme) || 'light');
    return '<header class="site-header' + tone + '"' + (ctx.edit ? ' data-site-header' : '') + '>' +
      '<div class="header-inner">' +
      '<a class="logo" href="' + esc(href('/', ctx)) + '">' + imgTag(s.logo, s.siteName, Object.assign({}, ctx, { first: true }), { sizes: '128px' }) + '</a>' +
      '<nav class="main-nav">' + navLinks + social + cta + '</nav>' +
      '<button class="menu-toggle" aria-label="Open menu" aria-expanded="false">' + ICONS.menu + ICONS.close + '</button>' +
      '</div>' +
      '<nav class="mobile-nav">' + navLinks + '<div class="mobile-social">' + social + '</div>' + cta + '</nav>' +
      '</header>';
  }

  function renderFooter(site, ctx) {
    if (!site.footer) return '';
    var sCtx = Object.assign({}, ctx, { first: false });
    return '<footer class="site-footer"' + (ctx.edit ? ' data-site-footer' : '') + '>' + renderSection(site.footer, sCtx) +
      '<div class="footer-bottom">' + esc((site.settings || {}).copyright || '').replace('{year}', new Date().getFullYear()) + '</div></footer>';
  }

  function renderPage(site, page, ctx) {
    ctx = ctx || {};
    var sections = (page.sections || []).map(function (s, i) { return renderSection(s, Object.assign({}, ctx, { first: i === 0 })); }).join('');
    if (ctx.edit && !(page.sections || []).length) sections = '<div class="page-empty">Drag a section from the left panel to start this page</div>';
    return renderHeader(site, page, ctx) +
      '<main class="site-main"' + (ctx.edit ? ' data-sections' : '') + '>' + sections + '</main>' +
      renderFooter(site, ctx);
  }

  // Fonts offered in Site Settings (all from Google Fonts).
  var FONTS = {
    'Montserrat': 'sans-serif', 'Poppins': 'sans-serif', 'Inter': 'sans-serif', 'DM Sans': 'sans-serif',
    'Raleway': 'sans-serif', 'Oswald': 'sans-serif', 'Open Sans': 'sans-serif', 'Roboto': 'sans-serif',
    'Playfair Display': 'serif', 'Lora': 'serif', 'Cormorant Garamond': 'serif'
  };
  function fontStack(name) {
    if (!name) return '';
    if (/,/.test(name)) return name;
    return "'" + name.replace(/'/g, '') + "', " + (FONTS[name] || 'sans-serif');
  }
  function fontsUrl(site) {
    var t = (site.settings && site.settings.theme) || {};
    var seen = {};
    [t.headingFont || 'Montserrat', t.bodyFont || 'Montserrat', t.buttonFont || 'Poppins'].forEach(function (f) {
      f = String(f).split(',')[0].replace(/['"]/g, '').trim();
      if (FONTS[f]) seen[f] = 1;
    });
    var fam = Object.keys(seen).map(function (f) { return 'family=' + f.replace(/ /g, '+') + ':wght@400;500;700'; });
    return fam.length ? 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap' : '';
  }

  // CSS custom properties from site settings (colours, fonts).
  function themeCss(site) {
    var t = (site.settings && site.settings.theme) || {};
    var map = {
      '--c-light': t.light, '--c-white': t.white, '--c-dark': t.dark, '--c-navy': t.navy,
      '--c-text': t.text, '--c-accent': t.accent, '--f-head': fontStack(t.headingFont), '--f-body': fontStack(t.bodyFont), '--f-button': fontStack(t.buttonFont)
    };
    var out = [];
    Object.keys(map).forEach(function (k) { if (map[k]) out.push(k + ':' + String(map[k]).replace(/[<>{};]/g, '')); });
    if (t.uppercase === false) out.push('--tt:none');
    return ':root{' + out.join(';') + '}';
  }

  function findPage(site, slug) {
    slug = String(slug || '').replace(/^\/+|\/+$/g, '');
    return (site.pages || []).filter(function (p) { return (p.slug || '') === slug; })[0] || null;
  }

  return {
    esc: esc, renderPage: renderPage, renderSection: renderSection, renderBlock: renderBlock,
    renderHeader: renderHeader, renderFooter: renderFooter, themeCss: themeCss, fontsUrl: fontsUrl, FONTS: FONTS,
    findPage: findPage, pageUrl: pageUrl, LAYOUTS: LAYOUTS, BLOCK_TYPES: Object.keys(BLOCKS), ICONS: ICONS
  };
});
