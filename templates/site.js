// Pages arrive pre-rendered. This script keeps the JSON files authoritative:
// it loads site.json + content.json and re-renders only when they changed
// since the HTML was built, then wires up the interactive bits.
(function () {
  'use strict';

  var R = window.SiteRender;
  var html = document.documentElement;
  var root = document.body.getAttribute('data-root') || '.';
  var isFile = location.protocol === 'file:';

  function currentSlug() {
    if (root === '.') return 'home';
    return decodeURIComponent(location.pathname.replace(/\/(index\.html)?$/, '').split('/').pop());
  }

  function apply(site, page) {
    var out = R.renderPage(site, page, { root: root, current: currentSlug(), isFile: isFile });
    html.setAttribute('style', out.cssVars);
    html.setAttribute('data-rev', R.hash(site, page));
    document.body.className = out.bodyClass;
    var fonts = document.getElementById('fonts');
    if (fonts && fonts.getAttribute('href') !== out.fontsHref) fonts.setAttribute('href', out.fontsHref);
    document.getElementById('app').innerHTML = out.bodyHtml;
  }

  // Folder links ("about/") don't open index.html from disk.
  function fixFileLinks() {
    document.querySelectorAll('a[href$="/"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!/^[a-z]+:/i.test(href)) a.setAttribute('href', href + 'index.html');
    });
  }

  function wireUp() {
    if (isFile) fixFileLinks();

    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        nav.classList.toggle('open', open);
      });
    }

    var box = document.querySelector('.lightbox');
    if (!box) {
      box = document.createElement('div');
      box.className = 'lightbox';
      box.innerHTML = '<img alt="">';
      box.addEventListener('click', function () { box.classList.remove('open'); });
      document.body.appendChild(box);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
    }
    document.querySelectorAll('.gallery-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var big = box.querySelector('img');
        big.src = el.getAttribute('data-src');
        big.alt = el.getAttribute('aria-label') || '';
        box.classList.add('open');
      });
    });
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  wireUp();

  if (isFile || !R || html.hasAttribute('data-static')) return;
  Promise.all([getJson(root + '/site.json'), getJson('./content.json')])
    .then(function (r) {
      if (R.hash(r[0], r[1]) === html.getAttribute('data-rev')) return;
      apply(r[0], r[1]);
      wireUp();
    })
    .catch(function () { /* keep the pre-rendered page */ });
})();
