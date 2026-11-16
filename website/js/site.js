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
