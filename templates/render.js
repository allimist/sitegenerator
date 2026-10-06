// Shared page renderer: used by the server (pre-rendered HTML) and the browser
// (re-render when the JSON files changed). Pure string building, no DOM access.
(function (global, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.SiteRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
  }

  // FNV-1a over the JSON string. Volatile fields are left out so saving
  // timestamps or the image manifest doesn't force a client re-render.
  function hash(site, page) {
    var s = {};
    Object.keys(site).forEach(function (k) {
      if (k !== 'createdAt' && k !== 'updatedAt' && k !== 'images') s[k] = site[k];
    });
    var str = JSON.stringify({ site: s, page: page });
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function link(target, ctx) {
    if (!target) return '';
    if (/^(https?:|mailto:|tel:|#)/.test(target)) return target;
    var href = target === 'home' ? ctx.root + '/' : ctx.root + '/' + target + '/';
    return ctx.isFile ? href + 'index.html' : href;
  }

  function imgUrl(src, ctx) {
    if (!src) return '';
    return /^(https?:|data:|\/)/.test(src) ? src : ctx.root + '/' + src;
  }

  // <img> with WebP srcset when the image manifest knows the variants.
  function img(src, alt, ctx, opts) {
    if (!src) return '';
    opts = opts || {};
    var meta = ctx.images && ctx.images[src];
    var attrs = ' src="' + esc(imgUrl(src, ctx)) + '" alt="' + esc(alt || '') + '"';
    if (meta && meta.v && meta.v.length) {
      var base = src.replace(/\.[a-z0-9]+$/i, '');
      var srcset = meta.v.map(function (w) { return imgUrl(base + '-' + w + '.webp', ctx) + ' ' + w + 'w'; }).join(', ');
      attrs += ' srcset="' + esc(srcset) + '" sizes="' + esc(opts.sizes || '100vw') + '"';
    }
    if (meta && meta.w && meta.h) attrs += ' width="' + meta.w + '" height="' + meta.h + '"';
    attrs += opts.eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
    return '<img' + attrs + '>';
  }

  function button(text, target, cls, ctx) {
    if (!text || !target) return '';
    return '<a class="btn ' + (cls || '') + '" href="' + esc(link(target, ctx)) + '">' + esc(text) + '</a>';
  }

  function title(text, cls) {
    if (cls === undefined) cls = 'section-title';
    return text ? '<h2' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(text) + '</h2>' : '';
  }

  function avatar(image, name, ctx) {
    return image
      ? '<div class="avatar">' + img(image, name, ctx, { sizes: '96px' }) + '</div>'
      : '<div class="avatar avatar-initials" aria-hidden="true">' + esc(initials(name)) + '</div>';
  }

  var SIZES_CARD = '(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw';
  var SIZES_HALF = '(min-width: 768px) 50vw, 100vw';

  // ---------- layout ----------

  function header(site, ctx) {
    var items = site.nav.map(function (n) {
      var active = n.slug === ctx.current ? ' aria-current="page"' : '';
      return '<li><a href="' + esc(link(n.slug, ctx)) + '"' + active + '>' + esc(n.title) + '</a></li>';
    }).join('');
    return '<header class="site-header"><div class="container header-inner">' +
      '<a class="logo" href="' + esc(link('home', ctx)) + '">' + esc(site.name) + '</a>' +
      '<button class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span><span></span><span></span></button>' +
      '<nav id="site-nav" class="site-nav"><ul>' + items + '</ul></nav>' +
      '</div></header>';
  }

  function footer(site, ctx) {
    var links = site.nav.map(function (n) {
      return '<li><a href="' + esc(link(n.slug, ctx)) + '">' + esc(n.title) + '</a></li>';
    }).join('');
    var contact = [
      site.address ? '<li>' + esc(site.address) + '</li>' : '',
      site.phone ? '<li><a href="tel:' + esc(site.phone.replace(/[^+\d]/g, '')) + '">' + esc(site.phone) + '</a></li>' : '',
      site.email ? '<li><a href="mailto:' + esc(site.email) + '">' + esc(site.email) + '</a></li>' : '',
    ].join('');
    return '<footer class="site-footer"><div class="container footer-inner">' +
      '<div class="footer-brand"><strong class="logo">' + esc(site.name) + '</strong><p>' + esc(site.tagline) + '</p></div>' +
      '<div class="footer-links"><h2 class="footer-title">Pages</h2><ul>' + links + '</ul></div>' +
      '<div class="footer-contact"><h2 class="footer-title">Contact</h2><ul>' + contact + '</ul></div>' +
      '</div><div class="container footer-bottom">' + esc(site.footer && site.footer.text) + '</div></footer>';
  }

  // ---------- blocks ----------

  var blocks = {
    hero: function (b, i, ctx) {
      var tag = i === 0 ? 'h1' : 'h2';
      return '<section class="block hero ' + (b.image ? 'has-img' : 'no-img') + '">' +
        (b.image ? '<div class="hero-media">' + img(b.image, b.imageAlt, ctx, { eager: i === 0, sizes: '100vw' }) + '</div>' : '') +
        '<div class="hero-body"><div class="hero-text">' +
        '<' + tag + '>' + esc(b.heading) + '</' + tag + '>' +
        (b.subheading ? '<p class="lead">' + esc(b.subheading) + '</p>' : '') +
        button(b.buttonText, b.buttonLink, 'btn-primary', ctx) +
        '</div></div></section>';
    },

    text: function (b) {
      return '<section class="block text"><div class="container narrow">' +
        title(b.heading, '') + paragraphs(b.body) + '</div></section>';
    },

    imageText: function (b, i, ctx) {
      ctx.imageTextCount = (ctx.imageTextCount || 0) + 1;
      var flip = ctx.imageTextCount % 2 === 0 ? ' flip' : '';
      return '<section class="block image-text' + flip + '"><div class="container split">' +
        (b.image ? '<div class="split-media">' + img(b.image, b.imageAlt || b.heading, ctx, { sizes: SIZES_HALF }) + '</div>' : '') +
        '<div class="split-body">' + title(b.heading, '') + paragraphs(b.body) +
        button(b.buttonText, b.buttonLink, 'btn-outline', ctx) + '</div>' +
        '</div></section>';
    },

    features: function (b, i, ctx) {
      var items = (b.items || []).map(function (it) {
        return '<article class="card">' +
          (it.image ? '<div class="card-media">' + img(it.image, it.imageAlt || it.title, ctx, { sizes: SIZES_CARD }) + '</div>' : '') +
          '<div class="card-body"><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></div></article>';
      }).join('');
      return '<section class="block features"><div class="container">' + title(b.heading) +
        '<div class="grid cols-' + Math.min((b.items || []).length, 4) + '">' + items + '</div></div></section>';
    },

    gallery: function (b, i, ctx) {
      var imgs = (b.images || []).map(function (g) {
        var item = typeof g === 'string' ? { src: g, alt: '' } : g || {};
        if (!item.src) return '';
        return '<button class="gallery-item" data-src="' + esc(imgUrl(item.src, ctx)) + '" aria-label="' + esc(item.alt || 'Open image') + '">' +
          img(item.src, item.alt, ctx, { sizes: '(min-width: 768px) 33vw, 50vw' }) + '</button>';
      }).join('');
      return '<section class="block gallery"><div class="container">' + title(b.heading) +
        '<div class="gallery-grid">' + imgs + '</div></div></section>';
    },

    cta: function (b, i, ctx) {
      return '<section class="block cta"><div class="container cta-inner">' +
        '<div><h2>' + esc(b.heading) + '</h2>' + (b.text ? '<p>' + esc(b.text) + '</p>' : '') + '</div>' +
        button(b.buttonText, b.buttonLink, 'btn-light', ctx) + '</div></section>';
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
        '<div class="split-body">' + title(b.heading, '') + '<ul class="contact-list">' + rows + '</ul></div>' +
        '<form class="contact-form card" action="mailto:' + esc(email) + '" method="post" enctype="text/plain">' +
        '<label>Name<input name="name" required autocomplete="name"></label>' +
        '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
        '<label>Message<textarea name="message" rows="5" required></textarea></label>' +
        '<button class="btn btn-primary" type="submit">Send message</button></form>' +
        '</div></section>';
    },

    testimonials: function (b, i, ctx) {
      var items = (b.items || []).map(function (t) {
        return '<figure class="card testimonial">' +
          '<blockquote>' + esc(t.quote) + '</blockquote>' +
          '<figcaption>' + avatar(t.image, t.name, ctx) +
          '<span><strong>' + esc(t.name) + '</strong>' + (t.role ? '<small>' + esc(t.role) + '</small>' : '') + '</span>' +
          '</figcaption></figure>';
      }).join('');
      return '<section class="block testimonials"><div class="container">' + title(b.heading) +
        '<div class="grid cols-' + Math.min((b.items || []).length, 3) + '">' + items + '</div></div></section>';
    },

    pricing: function (b, i, ctx) {
      var plans = (b.plans || []).map(function (p) {
        var features = String(p.features || '').split('\n').filter(function (f) { return f.trim(); })
          .map(function (f) { return '<li>' + esc(f.trim()) + '</li>'; }).join('');
        return '<article class="card plan' + (p.highlighted ? ' highlighted' : '') + '">' +
          (p.highlighted ? '<span class="plan-badge">Popular</span>' : '') +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p class="price"><strong>' + esc(p.price) + '</strong>' + (p.period ? '<span>' + esc(p.period) + '</span>' : '') + '</p>' +
          (features ? '<ul class="plan-features">' + features + '</ul>' : '') +
          button(p.buttonText, p.buttonLink, p.highlighted ? 'btn-primary' : 'btn-outline', ctx) +
          '</article>';
      }).join('');
      return '<section class="block pricing"><div class="container">' + title(b.heading) +
        '<div class="grid cols-' + Math.min((b.plans || []).length, 4) + '">' + plans + '</div></div></section>';
    },

    faq: function (b) {
      var items = (b.items || []).filter(function (q) { return q.question; });
      var ld = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map(function (q) {
          return { '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer || '' } };
        }),
      };
      return '<section class="block faq"><div class="container narrow">' + title(b.heading) +
        '<div class="faq-list">' + items.map(function (q) {
          return '<details class="faq-item"><summary>' + esc(q.question) + '</summary><div class="faq-answer">' + paragraphs(q.answer) + '</div></details>';
        }).join('') + '</div>' +
        (items.length ? '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' : '') +
        '</div></section>';
    },

    team: function (b, i, ctx) {
      var members = (b.members || []).map(function (m) {
        return '<article class="member">' + avatar(m.image, m.name, ctx) +
          '<h3>' + esc(m.name) + '</h3>' + (m.role ? '<p class="member-role">' + esc(m.role) + '</p>' : '') +
          (m.bio ? '<p class="member-bio">' + esc(m.bio) + '</p>' : '') + '</article>';
      }).join('');
      return '<section class="block team"><div class="container">' + title(b.heading) +
        '<div class="grid cols-' + Math.min((b.members || []).length, 4) + '">' + members + '</div></div></section>';
    },

    map: function (b) {
      if (!b.address) return '';
      var src = 'https://maps.google.com/maps?q=' + encodeURIComponent(b.address) + '&output=embed';
      return '<section class="block map"><div class="container">' + title(b.heading) +
        '<div class="embed embed-map"><iframe src="' + esc(src) + '" title="' + esc('Map: ' + b.address) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
        '<p class="embed-caption">' + esc(b.address) + '</p></div></section>';
    },

    video: function (b) {
      var url = String(b.url || '');
      var yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
      var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      var src = yt ? 'https://www.youtube-nocookie.com/embed/' + yt[1] : vm ? 'https://player.vimeo.com/video/' + vm[1] : '';
      var media = src
        ? '<div class="embed"><iframe src="' + esc(src) + '" title="' + esc(b.heading || 'Video') + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
        : url ? '<p><a href="' + esc(url) + '">' + esc(url) + '</a></p>' : '';
      return '<section class="block video"><div class="container narrow">' + title(b.heading) + media +
        (b.caption ? '<p class="embed-caption">' + esc(b.caption) + '</p>' : '') + '</div></section>';
    },
  };

  // ---------- theme ----------

  function cssVars(theme) {
    var c = theme.colors;
    var vars = ['primary', 'secondary', 'accent', 'bg', 'surface', 'text', 'muted'].map(function (k) {
      return '--c-' + k + ':' + c[k];
    });
    vars.push('--c-on-primary:' + (c.onPrimary || '#fff'));
    vars.push('--f-heading:"' + theme.fonts.heading + '", Georgia, serif');
    vars.push('--f-body:"' + theme.fonts.body + '", system-ui, sans-serif');
    return vars.join(';');
  }

  function bodyClass(theme) {
    var L = theme.layout;
    return ['hdr-' + L.header, 'hero-' + L.hero, 'sec-' + L.sections, 'rad-' + L.radius, 'ftr-' + L.footer, 'mode-' + theme.colors.mode].join(' ');
  }

  function fontsHref(theme) {
    var fams = [theme.fonts.heading, theme.fonts.body].map(function (f) {
      return 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;700';
    });
    return 'https://fonts.googleapis.com/css2?' + fams.join('&') + '&display=swap';
  }

  // ctx: { root: '.' | '..', current: slug, isFile: bool }
  function renderPage(site, page, opts) {
    var ctx = { root: opts.root, current: opts.current, isFile: !!opts.isFile, site: site, images: site.images || {} };
    var main = (page.blocks || []).map(function (b, i) {
      return blocks[b.type] ? blocks[b.type](b, i, ctx) : '';
    }).join('');
    return {
      bodyHtml: header(site, ctx) + '<main id="main">' + main + '</main>' + footer(site, ctx),
      bodyClass: bodyClass(site.theme),
      cssVars: cssVars(site.theme),
      fontsHref: fontsHref(site.theme),
    };
  }

  return { renderPage: renderPage, hash: hash, esc: esc, link: link, imgUrl: imgUrl, blockTypes: Object.keys(blocks) };
});
