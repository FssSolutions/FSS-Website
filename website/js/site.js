/*
 * FSS Solutions — public site behaviour.
 * - On the built (static) site the HTML is already rendered; this only wires up
 *   the mobile menu, contact forms and the gallery lightbox.
 * - In development (server.js) index.html is an empty shell, so this renders
 *   the current page from content.json first.
 */
(function () {
  'use strict';
  var root = document.getElementById('site-root');

  // Same markup as reviewCard() in render.js.
  window.FSSReviewCard = window.FSSReviewCard || function (it) {
    var e = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var r = Math.max(0, Math.min(5, Math.round(it.rating || 5)));
    var who = e(it.author || 'Customer');
    if (it.authorUrl) who = '<a href="' + e(it.authorUrl) + '" target="_blank" rel="noopener nofollow">' + who + '</a>';
    return '<figure class="rv-card"><div class="rv-stars" aria-label="' + r + ' out of 5 stars">' + '★★★★★'.slice(0, r) + '<span class="rv-off">' + '★★★★★'.slice(0, 5 - r) + '</span></div>' +
      '<blockquote>' + e(it.text) + '</blockquote><figcaption class="rv-author">' +
      (it.photo ? '<img src="' + e(it.photo) + '" alt="" width="36" height="36" loading="lazy" referrerpolicy="no-referrer">' : '') +
      '<span><b>' + who + '</b>' + (it.date || it.when ? '<small>' + e(it.date || it.when) + '</small>' : '') + '</span></figcaption></figure>';
  };

  function init() {
    // Mobile menu
    var header = root.querySelector('.site-header');
    var toggle = header && header.querySelector('.menu-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Forms: post to a form service if an action URL is set, otherwise open an email.
    root.querySelectorAll('form.b-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var status = form.querySelector('.f-status');
        var data = new FormData(form);
        var action = form.getAttribute('data-action');
        var done = function () { form.reset(); status.textContent = form.getAttribute('data-success'); };
        if (action) {
          status.textContent = 'Sending…';
          fetch(action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
            .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
            .catch(function () { status.textContent = 'Sorry, something went wrong. Please email us directly.'; });
        } else {
          var lines = [];
          form.querySelectorAll('.f-field').forEach(function (f) {
            var input = f.querySelector('input,textarea');
            lines.push(f.querySelector('.f-label').firstChild.textContent.trim() + ': ' + input.value);
          });
          var mail = 'mailto:' + (form.getAttribute('data-email') || '') +
            '?subject=' + encodeURIComponent(form.getAttribute('data-subject') || 'Website enquiry') +
            '&body=' + encodeURIComponent(lines.join('\n'));
          window.location.href = mail;
          done();
        }
      });
    });

    // Live Google reviews (only when the Reviews block has "live" on and the Google key is set up)
    root.querySelectorAll('.b-reviews[data-live="1"]').forEach(function (box) {
      var load = function () {
        fetch('/api/reviews').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
          if (!d || !d.reviews || !d.reviews.length || !window.FSSReviewCard) return;
          var max = parseInt(box.getAttribute('data-max'), 10) || 3;
          var list = d.reviews.filter(function (x) { return x.text; }).slice(0, max);
          if (!list.length) return;
          box.querySelector('.rv-grid').innerHTML = list.map(window.FSSReviewCard).join('');
          if (d.rating) {
            var n = Math.round(d.rating), s = box.querySelector('.rv-summary');
            s.innerHTML = '<span class="rv-stars" aria-hidden="true">' + '★★★★★'.slice(0, n) + '<span class="rv-off">' + '★★★★★'.slice(0, 5 - n) + '</span></span> <b>' +
              d.rating.toFixed(1) + '</b>' + (d.count ? ' · ' + d.count + ' Google review' + (d.count === 1 ? '' : 's') : '');
          }
          var all = box.querySelector('.rv-all');
          if (all && d.url) all.href = d.url;
          if (d.writeUrl && !box.querySelector('.rv-write')) {
            var links = box.querySelector('.rv-links');
            if (!links) { links = document.createElement('p'); links.className = 'rv-links'; box.appendChild(links); }
            var w = document.createElement('a');
            w.className = 'rv-write'; w.href = d.writeUrl; w.target = '_blank'; w.rel = 'noopener'; w.textContent = 'Leave a review';
            links.appendChild(w);
          }
          if (!box.querySelector('.rv-source')) {
            var src = document.createElement('p');
            src.className = 'rv-source';
            src.textContent = 'Reviews from Google';
            box.appendChild(src);
          }
        }).catch(function () { /* keep the reviews already on the page */ });
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
        }, { rootMargin: '400px' });
        io.observe(box);
      } else load();
    });

    // Gallery lightbox
    root.querySelectorAll('.b-gallery').forEach(function (g) {
      var imgs = Array.prototype.slice.call(g.querySelectorAll('img'));
      imgs.forEach(function (img, i) {
        img.addEventListener('click', function () { openLightbox(imgs, i); });
      });
    });
  }

  function openLightbox(imgs, index) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<img alt=""><button class="lb-close" aria-label="Close">×</button>' +
      (imgs.length > 1 ? '<button class="lb-prev" aria-label="Previous">‹</button><button class="lb-next" aria-label="Next">›</button>' : '');
    var big = lb.querySelector('img');
    function show(i) { index = (i + imgs.length) % imgs.length; big.src = imgs[index].getAttribute('data-full') || imgs[index].src; big.alt = imgs[index].alt; }
    function close() { lb.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') show(index - 1); if (e.key === 'ArrowRight') show(index + 1); }
    lb.addEventListener('click', function (e) {
      if (e.target.classList.contains('lb-prev')) show(index - 1);
      else if (e.target.classList.contains('lb-next')) show(index + 1);
      else if (e.target !== big) close();
    });
    document.addEventListener('keydown', key);
    show(index);
    document.body.appendChild(lb);
  }

  if (root.children.length) { init(); return; }

  // Development shell: render from content.json
  fetch('/content.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (site) {
    var R = window.FSSRender;
    var page = R.findPage(site, decodeURIComponent(location.pathname));
    var style = document.createElement('style');
    style.textContent = R.themeCss(site);
    document.head.appendChild(style);
    var fonts = document.createElement('link');
    fonts.rel = 'stylesheet'; fonts.href = R.fontsUrl(site);
    document.head.appendChild(fonts);
    if (!page) {
      root.innerHTML = R.renderHeader(site, { slug: '__404' }, {}) + '<main class="site-main"><div class="not-found"><h1>Page not found</h1><p><a href="/">Back to home</a></p></div></main>' + R.renderFooter(site, {});
    } else {
      document.title = page.seoTitle || (page.fullTitle ? page.title : page.title + (site.settings.titleSuffix || ''));
      root.innerHTML = R.renderPage(site, page, {});
    }
    init();
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  });
})();
