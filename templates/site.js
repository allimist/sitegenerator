// Renders a page from ../site.json (theme, nav) and ./content.json (blocks).
(function () {
  'use strict';

  var root = document.body.getAttribute('data-root') || '.';
  var isFile = location.protocol === 'file:';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function paragraphs(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .filter(Boolean)
      .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function link(target) {
    if (!target) return '';
    if (/^(https?:|mailto:|tel:|#)/.test(target)) return target;
    var href = target === 'home' ? root + '/' : root + '/' + target + '/';
    return isFile ? href + 'index.html' : href;
  }

  function img(src) {
    if (!src) return '';
    return /^(https?:|data:|\/)/.test(src) ? src : root + '/' + src;
  }

  function button(text, target, cls) {
    if (!text || !target) return '';
    return '<a class="btn ' + (cls || '') + '" href="' + esc(link(target)) + '">' + esc(text) + '</a>';
  }

  // ---------- theme ----------

  function applyTheme(theme) {
    var c = theme.colors, s = document.documentElement.style;
    ['primary', 'secondary', 'accent', 'bg', 'surface', 'text', 'muted'].forEach(function (k) {
      s.setProperty('--c-' + k, c[k]);
    });
    s.setProperty('--c-on-primary', c.onPrimary || '#fff');
    s.setProperty('--f-heading', '"' + theme.fonts.heading + '", Georgia, serif');
    s.setProperty('--f-body', '"' + theme.fonts.body + '", system-ui, sans-serif');
    var L = theme.layout;
    document.body.className = [
      'hdr-' + L.header, 'hero-' + L.hero, 'sec-' + L.sections, 'rad-' + L.radius, 'ftr-' + L.footer, 'mode-' + c.mode,
    ].join(' ');
    var fonts = [theme.fonts.heading, theme.fonts.body].map(function (f) {
      return 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;700';
    });
    var linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = 'https://fonts.googleapis.com/css2?' + fonts.join('&') + '&display=swap';
    document.head.appendChild(linkEl);
    var meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = c.primary;
    document.head.appendChild(meta);
  }

  // ---------- layout ----------

  function header(site, current) {
    var items = site.nav.map(function (n) {
      var active = n.slug === current ? ' aria-current="page"' : '';
      return '<li><a href="' + esc(link(n.slug)) + '"' + active + '>' + esc(n.title) + '</a></li>';
    }).join('');
    return '<header class="site-header"><div class="container header-inner">' +
      '<a class="logo" href="' + esc(link('home')) + '">' + esc(site.name) + '</a>' +
      '<button class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span><span></span><span></span></button>' +
      '<nav id="site-nav" class="site-nav"><ul>' + items + '</ul></nav>' +
      '</div></header>';
  }

  function footer(site) {
    var links = site.nav.map(function (n) {
      return '<li><a href="' + esc(link(n.slug)) + '">' + esc(n.title) + '</a></li>';
    }).join('');
    var contact = [
      site.address ? '<li>' + esc(site.address) + '</li>' : '',
      site.phone ? '<li><a href="tel:' + esc(site.phone.replace(/[^+\d]/g, '')) + '">' + esc(site.phone) + '</a></li>' : '',
      site.email ? '<li><a href="mailto:' + esc(site.email) + '">' + esc(site.email) + '</a></li>' : '',
    ].join('');
    return '<footer class="site-footer"><div class="container footer-inner">' +
      '<div class="footer-brand"><strong class="logo">' + esc(site.name) + '</strong><p>' + esc(site.tagline) + '</p></div>' +
      '<div class="footer-links"><h4>Pages</h4><ul>' + links + '</ul></div>' +
      '<div class="footer-contact"><h4>Contact</h4><ul>' + contact + '</ul></div>' +
      '</div><div class="container footer-bottom">' + esc(site.footer && site.footer.text) + '</div></footer>';
  }

  // ---------- blocks ----------

  var blocks = {
    hero: function (b, i) {
      var tag = i === 0 ? 'h1' : 'h2';
      return '<section class="block hero ' + (b.image ? 'has-img' : 'no-img') + '">' +
        (b.image ? '<div class="hero-media"><img src="' + esc(img(b.image)) + '" alt="" ' + (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + '></div>' : '') +
        '<div class="hero-body"><div class="hero-text">' +
        '<' + tag + '>' + esc(b.heading) + '</' + tag + '>' +
        (b.subheading ? '<p class="lead">' + esc(b.subheading) + '</p>' : '') +
        button(b.buttonText, b.buttonLink, 'btn-primary') +
        '</div></div></section>';
    },

    text: function (b) {
      return '<section class="block text"><div class="container narrow">' +
        (b.heading ? '<h2>' + esc(b.heading) + '</h2>' : '') + paragraphs(b.body) +
        '</div></section>';
    },

    imageText: function (b, i, ctx) {
      ctx.imageTextCount = (ctx.imageTextCount || 0) + 1;
      var flip = ctx.imageTextCount % 2 === 0 ? ' flip' : '';
      return '<section class="block image-text' + flip + '"><div class="container split">' +
        (b.image ? '<div class="split-media"><img src="' + esc(img(b.image)) + '" alt="' + esc(b.heading) + '" loading="lazy"></div>' : '') +
        '<div class="split-body">' + (b.heading ? '<h2>' + esc(b.heading) + '</h2>' : '') + paragraphs(b.body) +
        button(b.buttonText, b.buttonLink, 'btn-outline') + '</div>' +
        '</div></section>';
    },

    features: function (b) {
      var items = (b.items || []).map(function (it) {
        return '<article class="card">' +
          (it.image ? '<div class="card-media"><img src="' + esc(img(it.image)) + '" alt="' + esc(it.title) + '" loading="lazy"></div>' : '') +
          '<div class="card-body"><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></div></article>';
      }).join('');
      return '<section class="block features"><div class="container">' +
        (b.heading ? '<h2 class="section-title">' + esc(b.heading) + '</h2>' : '') +
        '<div class="grid cols-' + Math.min((b.items || []).length, 4) + '">' + items + '</div></div></section>';
    },

    gallery: function (b) {
      var imgs = (b.images || []).filter(Boolean).map(function (src) {
        return '<button class="gallery-item" data-src="' + esc(img(src)) + '"><img src="' + esc(img(src)) + '" alt="" loading="lazy"></button>';
      }).join('');
      return '<section class="block gallery"><div class="container">' +
        (b.heading ? '<h2 class="section-title">' + esc(b.heading) + '</h2>' : '') +
        '<div class="gallery-grid">' + imgs + '</div></div></section>';
    },

    cta: function (b) {
      return '<section class="block cta"><div class="container cta-inner">' +
        '<div><h2>' + esc(b.heading) + '</h2>' + (b.text ? '<p>' + esc(b.text) + '</p>' : '') + '</div>' +
        button(b.buttonText, b.buttonLink, 'btn-light') + '</div></section>';
    },

    contact: function (b, i, ctx) {
      var email = b.email || ctx.site.email;
      var rows = [
        b.address ? '<li><span class="label">Address</span>' + esc(b.address) + '</li>' : '',
        b.phone ? '<li><span class="label">Phone</span><a href="tel:' + esc(b.phone.replace(/[^+\d]/g, '')) + '">' + esc(b.phone) + '</a></li>' : '',
        email ? '<li><span class="label">Email</span><a href="mailto:' + esc(email) + '">' + esc(email) + '</a></li>' : '',
        b.hours ? '<li><span class="label">Hours</span>' + esc(b.hours) + '</li>' : '',
      ].join('');
      return '<section class="block contact"><div class="container split">' +
        '<div class="split-body">' + (b.heading ? '<h2>' + esc(b.heading) + '</h2>' : '') + '<ul class="contact-list">' + rows + '</ul></div>' +
        '<form class="contact-form card" action="mailto:' + esc(email) + '" method="post" enctype="text/plain">' +
        '<label>Name<input name="name" required autocomplete="name"></label>' +
        '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
        '<label>Message<textarea name="message" rows="5" required></textarea></label>' +
        '<button class="btn btn-primary" type="submit">Send message</button></form>' +
        '</div></section>';
    },
  };

  // ---------- behaviour ----------

  function wireUp() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('site-nav');
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<img alt="">';
    box.addEventListener('click', function () { box.classList.remove('open'); });
    document.body.appendChild(box);
    document.querySelectorAll('.gallery-item').forEach(function (el) {
      el.addEventListener('click', function () {
        box.querySelector('img').src = el.getAttribute('data-src');
        box.classList.add('open');
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
  }

  function render(site, page) {
    var current = root === '.' ? 'home' : decodeURIComponent(location.pathname.replace(/\/(index\.html)?$/, '').split('/').pop());
    applyTheme(site.theme);
    var ctx = { site: site };
    var body = (page.blocks || []).map(function (b, i) {
      return blocks[b.type] ? blocks[b.type](b, i, ctx) : '';
    }).join('');
    document.getElementById('app').innerHTML = header(site, current) + '<main>' + body + '</main>' + footer(site);
    document.body.classList.remove('is-loading');
    wireUp();
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function fallback() {
    var el = document.getElementById('inline-data');
    if (!el) throw new Error('No page data found');
    var data = JSON.parse(el.textContent);
    render(data.site, data.page);
  }

  if (isFile) {
    fallback();
  } else {
    Promise.all([getJson(root + '/site.json'), getJson('./content.json')])
      .then(function (r) { render(r[0], r[1]); })
      .catch(function (err) {
        try { fallback(); } catch (e) {
          document.getElementById('app').innerHTML = '<p style="padding:2rem">Could not load page: ' + esc(err.message) + '</p>';
        }
      });
  }
})();
