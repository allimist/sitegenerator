// Admin SPA: dashboard, create form, page/site editor, image picker.
'use strict';

// ---------- helpers ----------

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg, type = 'ok') {
  const t = el('div', { class: `toast ${type}` }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('hide'), 2600);
  setTimeout(() => t.remove(), 3000);
}

const fail = (err) => toast(err.message || String(err), 'error');
const view = () => document.getElementById('view');
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const siteUrl = (domain, slug) => `/sites/${domain}/${slug && slug !== 'home' ? slug + '/' : ''}`;
const imgUrl = (domain, p) => (!p ? '' : /^(https?:|\/)/.test(p) ? p : `/sites/${domain}/${p}`);

// ---------- modal dialogs (no native alert/confirm/prompt) ----------

function modal(title, body, actions, opts = {}) {
  return new Promise((resolve) => {
    const close = (val) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = (e) => e.key === 'Escape' && close(null);
    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => e.target === overlay && close(null) },
      el('div', { class: `modal ${opts.wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        el('div', { class: 'modal-head' }, el('h3', {}, title), el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close(null) }, '✕')),
        el('div', { class: 'modal-body' }, body),
        actions && actions.length ? el('div', { class: 'modal-actions' }, actions.map((a) => el('button', { class: `btn ${a.class || ''}`, onclick: () => close(a.value ? a.value() : true) }, a.label))) : null
      )
    );
    document.addEventListener('keydown', onKey);
    document.getElementById('modal-root').append(overlay);
    const first = overlay.querySelector('input, textarea, select');
    if (first) first.focus();
    overlay.closeWith = close;
  });
}

function confirmDialog(title, message, okLabel = 'Delete') {
  return modal(title, el('p', {}, message), [
    { label: 'Cancel', class: 'ghost', value: () => null },
    { label: okLabel, class: 'danger' },
  ]);
}

// Form dialog: fields = [{name, label, value}] → resolves {name: value} or null.
function formDialog(title, fields, okLabel = 'Save') {
  const inputs = {};
  const form = el('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); form.closest('.modal').querySelector('.modal-actions .primary').click(); } },
    fields.map((f) => el('label', { class: 'field' }, f.label, (inputs[f.name] = el('input', { value: f.value || '', placeholder: f.placeholder || '' })), f.hint ? el('small', {}, f.hint) : null)),
    el('button', { type: 'submit', hidden: true })
  );
  if (fields.some((f) => f.slugFrom)) {
    fields.filter((f) => f.slugFrom).forEach((f) => {
      inputs[f.slugFrom].addEventListener('input', () => { if (!inputs[f.name].dataset.touched) inputs[f.name].value = slugify(inputs[f.slugFrom].value); });
      inputs[f.name].addEventListener('input', () => (inputs[f.name].dataset.touched = '1'));
    });
  }
  return modal(title, form, [
    { label: 'Cancel', class: 'ghost', value: () => null },
    { label: okLabel, class: 'primary', value: () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()])) },
  ]);
}

// ---------- router ----------

let leaveGuard = null;

async function route() {
  if (leaveGuard && !leaveGuard()) return;
  leaveGuard = null;
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  document.body.dataset.view = parts[0] || 'home';
  try {
    if (parts[0] === 'new') return renderCreate();
    if (parts[0] === 'site' && parts[1]) return await renderEditor(parts[1], parts[2] || 'home');
    return await renderDashboard();
  } catch (err) {
    view().replaceChildren(el('div', { class: 'container empty' }, el('h2', {}, 'Something went wrong'), el('p', {}, err.message), el('a', { href: '#/', class: 'btn' }, 'Back to sites')));
  }
}
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => { if (state.dirty) e.preventDefault(); });

// ---------- dashboard ----------

async function renderDashboard() {
  const sites = await api('GET', '/api/sites');
  const grid = el('div', { class: 'site-grid' });
  if (!sites.length) {
    grid.append(el('div', { class: 'empty' }, el('h2', {}, 'No sites yet'), el('p', {}, 'Create your first site. Use the 🎲 Random button for a quick start.'), el('a', { href: '#/new', class: 'btn primary' }, '+ New site')));
  }
  for (const s of sites) {
    const c = s.colors;
    grid.append(el('article', { class: 'site-card' },
      el('a', { class: 'site-thumb', href: `#/site/${s.domain}`, style: `background:${c.bg};color:${c.text}` },
        el('div', { class: 'thumb-bar', style: `background:${c.primary}` }),
        el('strong', { style: `color:${c.primary}` }, s.name),
        el('span', {}, s.tagline),
        el('div', { class: 'swatches' }, ['primary', 'secondary', 'accent', 'surface', 'text'].map((k) => el('i', { style: `background:${c[k]}`, title: k })))
      ),
      el('div', { class: 'site-meta' },
        el('div', {}, el('h3', {}, s.name), el('p', { class: 'muted' }, `${s.domain} · ${s.pages} pages`)),
        el('div', { class: 'row' },
          el('a', { class: 'btn small primary', href: `#/site/${s.domain}` }, 'Edit'),
          el('a', { class: 'btn small', href: siteUrl(s.domain), target: '_blank' }, 'Preview ↗'),
          el('a', { class: 'btn small', href: `/api/sites/${s.domain}/export`, download: `${s.domain}.zip` }, '⬇ Export ZIP'),
          el('button', {
            class: 'btn small ghost danger-text',
            onclick: async () => {
              if (!(await confirmDialog('Delete site', `Delete ${s.domain} and all its pages? This cannot be undone.`))) return;
              await api('DELETE', `/api/sites/${s.domain}`).then(() => { toast('Site deleted'); route(); }, fail);
            },
          }, 'Delete')
        )
      )
    ));
  }
  view().replaceChildren(el('div', { class: 'container' },
    el('div', { class: 'page-head' }, el('h1', {}, 'Your sites'), el('a', { href: '#/new', class: 'btn primary' }, '+ New site')),
    grid
  ));
}

// ---------- create form ----------

let presetsCache = null;

async function renderCreate() {
  presetsCache = presetsCache || (await api('GET', '/api/presets'));
  const f = {};
  const pagesBox = el('div', { class: 'checks' });

  const renderPages = (preset, checked) => {
    pagesBox.replaceChildren(...preset.pages.map((p) =>
      el('label', { class: 'check' }, el('input', { type: 'checkbox', value: p.slug, checked: p.slug === 'home' || !checked || checked.includes(p.slug), disabled: p.slug === 'home' }), p.title)
    ));
  };

  const fill = (preset) => {
    f.presetId.value = preset.id;
    f.name.value = preset.name;
    f.domain.value = preset.domain;
    f.tagline.value = preset.tagline;
    f.email.value = preset.email;
    f.phone.value = preset.phone;
    f.address.value = preset.address;
    renderPages(preset);
  };

  const input = (name, label, attrs = {}) => el('label', { class: 'field' }, label, (f[name] = el('input', { name, ...attrs })));

  const submit = el('button', { class: 'btn primary big', type: 'submit' }, 'Create site');
  const form = el('form', {
    class: 'card create-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const body = {
        presetId: f.presetId.value,
        name: f.name.value,
        domain: f.domain.value,
        tagline: f.tagline.value,
        email: f.email.value,
        phone: f.phone.value,
        address: f.address.value,
        pages: [...pagesBox.querySelectorAll('input:checked')].map((i) => i.value),
      };
      submit.disabled = true;
      submit.textContent = 'Generating site and fetching images…';
      form.classList.add('busy');
      try {
        const site = await api('POST', '/api/sites', body);
        toast(`${site.name} created`);
        location.hash = `#/site/${site.domain}`;
      } catch (err) {
        fail(err);
        submit.disabled = false;
        submit.textContent = 'Create site';
        form.classList.remove('busy');
      }
    },
  },
    el('div', { class: 'form-head' },
      el('div', {}, el('h1', {}, 'Create a new site'), el('p', { class: 'muted' }, 'Fill in the details, or press Random to pick one of 10 ready-made business types. Every site gets a random color theme and layout.')),
      el('button', { type: 'button', class: 'btn random', onclick: async () => fill(await api('GET', '/api/presets/random').catch(fail)) }, '🎲 Random')
    ),
    el('div', { class: 'form-grid' },
      el('label', { class: 'field' }, 'Business type',
        (f.presetId = el('select', { name: 'presetId', onchange: () => renderPages(presetsCache.find((p) => p.id === f.presetId.value)) },
          presetsCache.map((p) => el('option', { value: p.id }, p.label))))),
      input('name', 'Site name', { required: true, placeholder: 'My Business' }),
      input('domain', 'Domain', { required: true, placeholder: 'my-business.com', pattern: '[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', title: 'A domain like my-site.com' }),
      input('tagline', 'Tagline', { placeholder: 'A short slogan' }),
      input('email', 'Email', { type: 'email' }),
      input('phone', 'Phone'),
      input('address', 'Address')
    ),
    el('fieldset', { class: 'field' }, el('legend', {}, 'Pages'), pagesBox),
    el('div', { class: 'row end' }, el('a', { href: '#/', class: 'btn ghost' }, 'Cancel'), submit)
  );
  renderPages(presetsCache[0]);
  view().replaceChildren(el('div', { class: 'container narrow' }, form));
}

// ---------- editor ----------

const state = { site: null, slug: null, page: null, dirty: false, images: [] };

const BLOCKS = {
  hero: { label: 'Hero banner', fields: [['heading', 'Heading'], ['subheading', 'Subheading', 'textarea'], ['image', 'Background image', 'image'], ['buttonText', 'Button text'], ['buttonLink', 'Button link', 'link']] },
  text: { label: 'Text', fields: [['heading', 'Heading'], ['body', 'Text', 'textarea']] },
  imageText: { label: 'Image + text', fields: [['heading', 'Heading'], ['body', 'Text', 'textarea'], ['image', 'Image', 'image'], ['buttonText', 'Button text'], ['buttonLink', 'Button link', 'link']] },
  features: { label: 'Feature cards', fields: [['heading', 'Heading'], ['items', 'Cards', 'items']] },
  gallery: { label: 'Gallery', fields: [['heading', 'Heading'], ['images', 'Images', 'images']] },
  cta: { label: 'Call to action', fields: [['heading', 'Heading'], ['text', 'Text'], ['buttonText', 'Button text'], ['buttonLink', 'Button link', 'link']] },
  contact: { label: 'Contact', fields: [['heading', 'Heading'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email'], ['hours', 'Opening hours']] },
};

function newBlock(type) {
  const b = { type };
  for (const [key, , kind] of BLOCKS[type].fields) {
    b[key] = kind === 'items' ? [{ title: 'Card title', text: 'Short description.', image: '' }] : kind === 'images' ? [] : '';
  }
  if (b.heading === '') b.heading = BLOCKS[type].label;
  return b;
}

function setDirty(v = true) {
  state.dirty = v;
  document.body.classList.toggle('is-dirty', v);
}

async function renderEditor(domain, slug) {
  const [site, page] = await Promise.all([api('GET', `/api/sites/${domain}`), api('GET', `/api/sites/${domain}/pages/${slug}`)]);
  Object.assign(state, { site, slug, page });
  setDirty(false);
  leaveGuard = () => {
    if (!state.dirty) return true;
    // Hash already changed; ask, and restore the URL if the user stays.
    const target = location.hash;
    history.replaceState(null, '', `#/site/${state.site.domain}/${state.slug}`);
    confirmDialog('Unsaved changes', 'You have unsaved changes on this page. Leave without saving?', 'Discard changes').then((ok) => {
      if (ok) { setDirty(false); location.hash = target; }
    });
    return false;
  };

  view().replaceChildren(el('div', { class: 'editor' },
    el('aside', { class: 'sidebar', id: 'sidebar' }),
    el('section', { class: 'editor-main' },
      el('div', { class: 'editor-toolbar' },
        el('div', { class: 'crumbs' }, el('a', { href: '#/' }, 'Sites'), ' / ', el('strong', {}, site.name), ' / ', el('span', {}, state.page.title)),
        el('div', { class: 'row' },
          el('span', { class: 'dirty-dot', title: 'Unsaved changes' }, '● Unsaved'),
          el('button', { class: 'btn small ghost mobile-only', onclick: () => document.body.classList.toggle('show-preview') }, '👁 Preview'),
          el('button', { class: 'btn primary', id: 'save-btn', onclick: savePage }, 'Save page')
        )
      ),
      el('div', { id: 'page-form' })
    ),
    el('section', { class: 'preview' },
      el('div', { class: 'preview-bar' },
        el('div', { class: 'device-toggle' },
          el('button', { class: 'active', onclick: (e) => setDevice(e, '') }, '🖥 Desktop'),
          el('button', { onclick: (e) => setDevice(e, 'mobile') }, '📱 Mobile')),
        el('a', { href: siteUrl(domain, slug), target: '_blank', class: 'btn small ghost' }, 'Open ↗')),
      el('div', { class: 'preview-frame-wrap' }, el('iframe', { id: 'preview', src: siteUrl(domain, slug), title: 'Page preview' }))
    )
  ));
  renderSidebar();
  renderPageForm();
}

function setDevice(e, mode) {
  document.querySelectorAll('.device-toggle button').forEach((b) => b.classList.toggle('active', b === e.currentTarget));
  document.querySelector('.preview-frame-wrap').className = `preview-frame-wrap ${mode}`;
}

function reloadPreview() {
  const frame = document.getElementById('preview');
  if (frame) frame.src = siteUrl(state.site.domain, state.slug) + `?t=${Date.now()}`;
}

async function savePage() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  try {
    state.page = await api('PUT', `/api/sites/${state.site.domain}/pages/${state.slug}`, state.page);
    setDirty(false);
    toast('Page saved');
    reloadPreview();
  } catch (err) {
    fail(err);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's' && document.getElementById('save-btn')) {
    e.preventDefault();
    savePage();
  }
});

// ----- sidebar: pages, settings, theme -----

function renderSidebar() {
  const { site } = state;
  const d = site.domain;
  const pageApi = (slug, action) => `/api/sites/${d}/pages/${slug}${action ? '/' + action : ''}`;
  const go = (slug) => (location.hash = `#/site/${d}/${slug}`);
  const refreshSite = async () => {
    state.site = await api('GET', `/api/sites/${d}`);
    renderSidebar();
  };

  const moveNav = async (i, dir) => {
    const nav = [...site.nav];
    const j = i + dir;
    if (j < 0 || j >= nav.length) return;
    [nav[i], nav[j]] = [nav[j], nav[i]];
    await api('PUT', `/api/sites/${d}`, { nav }).then((s) => { state.site = s; renderSidebar(); reloadPreview(); }, fail);
  };

  const pages = el('ul', { class: 'page-list' }, site.nav.map((n, i) =>
    el('li', { class: n.slug === state.slug ? 'active' : '' },
      el('a', { href: `#/site/${d}/${n.slug}` }, el('span', {}, n.title), el('small', {}, n.slug === 'home' ? '/' : `/${n.slug}/`)),
      el('div', { class: 'page-actions' },
        el('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => moveNav(i, -1) }, '↑'),
        el('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', disabled: i === site.nav.length - 1, onclick: () => moveNav(i, 1) }, '↓'),
        el('button', {
          class: 'icon-btn', title: 'Clone page', 'aria-label': 'Clone page',
          onclick: async () => {
            const v = await formDialog(`Clone "${n.title}"`, [
              { name: 'title', label: 'New page title', value: `${n.title} copy` },
              { name: 'newSlug', label: 'Folder name (URL)', value: `${n.slug === 'home' ? 'home' : n.slug}-copy`, slugFrom: 'title', hint: 'Lowercase letters, numbers and dashes' },
            ], 'Clone');
            if (!v) return;
            await api('POST', pageApi(n.slug, 'clone'), v).then((r) => { toast('Page cloned'); go(r.slug); }, fail);
          },
        }, '⧉'),
        el('button', {
          class: 'icon-btn', title: 'Rename page', 'aria-label': 'Rename page',
          onclick: async () => {
            const fields = [{ name: 'title', label: 'Page title', value: n.title }];
            if (n.slug !== 'home') fields.push({ name: 'newSlug', label: 'Folder name (URL)', value: n.slug, hint: 'Links to this page are updated automatically' });
            const v = await formDialog(`Rename "${n.title}"`, fields, 'Rename');
            if (!v) return;
            await api('POST', pageApi(n.slug, 'rename'), v).then((r) => {
              toast('Page renamed');
              if (n.slug !== state.slug) return refreshSite();
              setDirty(false);
              if (r.slug === state.slug) route(); else go(r.slug);
            }, fail);
          },
        }, '✎'),
        n.slug !== 'home' && el('button', {
          class: 'icon-btn danger-text', title: 'Delete page', 'aria-label': 'Delete page',
          onclick: async () => {
            if (!(await confirmDialog('Delete page', `Delete the page "${n.title}" (/${n.slug}/)?`))) return;
            await api('DELETE', pageApi(n.slug)).then(() => {
              toast('Page deleted');
              if (n.slug === state.slug) { setDirty(false); go('home'); } else refreshSite();
            }, fail);
          },
        }, '🗑')
      )
    )
  ));

  const addPageBtn = el('button', {
    class: 'btn small block',
    onclick: async () => {
      const v = await formDialog('Add page', [
        { name: 'title', label: 'Page title', placeholder: 'Services' },
        { name: 'slug', label: 'Folder name (URL)', slugFrom: 'title', placeholder: 'services' },
      ], 'Add page');
      if (!v) return;
      await api('POST', `/api/sites/${d}/pages`, v).then((r) => { toast('Page added'); go(r.slug); }, fail);
    },
  }, '+ Add page');

  // Settings
  const s = {};
  const sInput = (key, label, value) => el('label', { class: 'field small' }, label, (s[key] = el('input', { value: value || '' })));
  const settings = el('details', { class: 'side-section' },
    el('summary', {}, 'Site settings'),
    sInput('name', 'Site name', site.name),
    sInput('tagline', 'Tagline', site.tagline),
    sInput('email', 'Email', site.email),
    sInput('phone', 'Phone', site.phone),
    sInput('address', 'Address', site.address),
    sInput('imageQuery', 'Image search keywords', site.imageQuery),
    sInput('footer', 'Footer text', site.footer.text),
    el('button', {
      class: 'btn small primary block',
      onclick: async () => {
        const body = Object.fromEntries(Object.entries(s).map(([k, i]) => [k, i.value]));
        body.footer = { text: body.footer };
        await api('PUT', `/api/sites/${d}`, body).then((r) => { state.site = r; toast('Settings saved'); renderSidebar(); reloadPreview(); }, fail);
      },
    }, 'Save settings')
  );

  // Theme
  const theme = structuredClone(site.theme);
  const LAYOUTS = { header: ['centered', 'left', 'split'], hero: ['fullImage', 'split', 'minimal'], sections: ['cards', 'alternating', 'stacked'], radius: ['sharp', 'soft', 'round'], footer: ['simple', 'columns'] };
  const themeBox = el('details', { class: 'side-section', open: true },
    el('summary', {}, 'Theme'),
    el('div', { class: 'color-grid' }, ['primary', 'secondary', 'accent', 'bg', 'surface', 'text', 'muted'].map((k) =>
      el('label', { class: 'color' }, el('input', { type: 'color', value: theme.colors[k], oninput: (e) => (theme.colors[k] = e.target.value) }), k))),
    el('div', { class: 'layout-grid' }, Object.entries(LAYOUTS).map(([k, opts]) =>
      el('label', { class: 'field small' }, k,
        el('select', { onchange: (e) => (theme.layout[k] = e.target.value) }, opts.map((o) => el('option', { value: o, selected: theme.layout[k] === o }, o)))))),
    el('p', { class: 'muted small' }, `Fonts: ${theme.fonts.heading} / ${theme.fonts.body}`),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn small primary',
        onclick: async () => api('PUT', `/api/sites/${d}`, { theme }).then((r) => { state.site = r; toast('Theme saved'); renderSidebar(); reloadPreview(); }, fail),
      }, 'Save theme'),
      el('button', {
        class: 'btn small random',
        onclick: async () => api('POST', `/api/sites/${d}/theme/randomize`).then((r) => { state.site = r; toast('New random theme'); renderSidebar(); reloadPreview(); }, fail),
      }, '🎲 Re-roll theme'))
  );

  document.getElementById('sidebar').replaceChildren(
    el('div', { class: 'side-head' },
      el('h2', {}, site.name),
      el('a', { href: siteUrl(d), target: '_blank', class: 'muted' }, d + ' ↗'),
      el('a', { class: 'btn small block', href: `/api/sites/${d}/export`, download: `${d}.zip` }, '⬇ Export ZIP')),
    el('div', { class: 'side-section' }, el('h4', {}, 'Pages'), pages, addPageBtn),
    themeBox,
    settings
  );
}

// ----- page form -----

function renderPageForm() {
  const { page } = state;
  const box = document.getElementById('page-form');
  const bind = (obj, key) => (e) => { obj[key] = e.target.value; setDirty(); };

  const meta = el('div', { class: 'card meta-card' },
    el('label', { class: 'field' }, 'Page title', el('input', { value: page.title || '', oninput: bind(page, 'title') })),
    el('label', { class: 'field' }, 'SEO description', el('input', { value: page.metaDescription || '', oninput: bind(page, 'metaDescription'), placeholder: 'Short description for search engines' }))
  );

  const blocks = page.blocks.map((b, i) => blockCard(b, i));
  const typeSel = el('select', {}, Object.entries(BLOCKS).map(([k, v]) => el('option', { value: k }, v.label)));
  const adder = el('div', { class: 'add-block card' },
    el('span', {}, 'Add a section'), typeSel,
    el('button', { class: 'btn small primary', onclick: () => { page.blocks.push(newBlock(typeSel.value)); setDirty(); renderPageForm(); } }, '+ Add'));

  box.replaceChildren(meta, ...blocks, adder);
}

function blockCard(b, i) {
  const { page } = state;
  const def = BLOCKS[b.type] || { label: b.type, fields: [] };
  const move = (dir) => {
    const j = i + dir;
    if (j < 0 || j >= page.blocks.length) return;
    [page.blocks[i], page.blocks[j]] = [page.blocks[j], page.blocks[i]];
    setDirty();
    renderPageForm();
  };
  const body = el('div', { class: 'block-fields' }, def.fields.map(([key, label, kind]) => field(b, key, label, kind)));
  return el('details', { class: 'card block-card', open: i < 2 },
    el('summary', {},
      el('span', { class: 'block-type' }, def.label),
      el('span', { class: 'block-title' }, b.heading || ''),
      el('span', { class: 'block-actions', onclick: (e) => e.preventDefault() },
        el('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(-1) }, '↑'),
        el('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', disabled: i === page.blocks.length - 1, onclick: () => move(1) }, '↓'),
        el('button', { class: 'icon-btn', title: 'Duplicate', 'aria-label': 'Duplicate section', onclick: () => { page.blocks.splice(i + 1, 0, structuredClone(b)); setDirty(); renderPageForm(); } }, '⧉'),
        el('button', {
          class: 'icon-btn danger-text', title: 'Remove', 'aria-label': 'Remove section',
          onclick: async () => {
            if (!(await confirmDialog('Remove section', `Remove this "${def.label}" section?`, 'Remove'))) return;
            page.blocks.splice(i, 1);
            setDirty();
            renderPageForm();
          },
        }, '🗑'))),
    body);
}

function field(obj, key, label, kind) {
  const onInput = (e) => { obj[key] = e.target.value; setDirty(); };
  if (kind === 'textarea') return el('label', { class: 'field' }, label, el('textarea', { rows: 4, oninput: onInput }, obj[key] || ''));
  if (kind === 'image') return imageField(obj, key, label);
  if (kind === 'link') {
    const listId = 'pages-list';
    if (!document.getElementById(listId)) {
      document.body.append(el('datalist', { id: listId }));
    }
    document.getElementById(listId).replaceChildren(...state.site.nav.map((n) => el('option', { value: n.slug }, n.title)));
    return el('label', { class: 'field' }, label, el('input', { value: obj[key] || '', list: listId, placeholder: 'page name (e.g. contact) or https://…', oninput: onInput }));
  }
  if (kind === 'items') {
    obj[key] = obj[key] || [];
    return el('div', { class: 'field' }, label,
      el('div', { class: 'items' }, obj[key].map((it, j) => el('div', { class: 'item' },
        el('div', { class: 'item-head' }, el('strong', {}, `Card ${j + 1}`),
          el('button', { class: 'icon-btn danger-text', 'aria-label': 'Remove card', onclick: () => { obj[key].splice(j, 1); setDirty(); renderPageForm(); } }, '✕')),
        field(it, 'title', 'Title'), field(it, 'text', 'Text', 'textarea'), imageField(it, 'image', 'Image (optional)')))),
      el('button', { class: 'btn small', onclick: () => { obj[key].push({ title: 'Card title', text: 'Short description.', image: '' }); setDirty(); renderPageForm(); } }, '+ Add card'));
  }
  if (kind === 'images') {
    obj[key] = obj[key] || [];
    return el('div', { class: 'field' }, label,
      el('div', { class: 'thumbs' }, obj[key].map((src, j) => el('div', { class: 'thumb' },
        el('img', { src: imgUrl(state.site.domain, src), alt: '' }),
        el('button', { class: 'icon-btn remove', 'aria-label': 'Remove image', onclick: () => { obj[key].splice(j, 1); setDirty(); renderPageForm(); } }, '✕'))),
      el('button', { class: 'thumb add', onclick: async () => { const p = await pickImage(); if (p) { obj[key].push(p); setDirty(); renderPageForm(); } } }, '+ Add')));
  }
  return el('label', { class: 'field' }, label, el('input', { value: obj[key] || '', oninput: onInput }));
}

function imageField(obj, key, label) {
  const preview = el('div', { class: 'image-preview' });
  const draw = () => preview.replaceChildren(obj[key] ? el('img', { src: imgUrl(state.site.domain, obj[key]), alt: '' }) : el('span', { class: 'muted' }, 'No image'));
  draw();
  return el('div', { class: 'field' }, label,
    el('div', { class: 'image-field' }, preview,
      el('div', { class: 'stack small' },
        el('button', { class: 'btn small', onclick: async () => { const p = await pickImage(); if (p) { obj[key] = p; setDirty(); draw(); } } }, obj[key] ? 'Change image' : 'Choose image'),
        obj[key] && el('button', { class: 'btn small ghost danger-text', onclick: () => { obj[key] = ''; setDirty(); renderPageForm(); } }, 'Remove'))));
}

// ---------- image picker ----------

function pickImage() {
  const d = state.site.domain;
  let resolveOuter;
  const result = new Promise((r) => (resolveOuter = r));
  const content = el('div', { class: 'picker-content' });
  const tabs = [['site', 'This site'], ['bank', 'Image bank'], ['online', 'Search online'], ['upload', 'Upload']];
  const tabBar = el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label]) =>
    el('button', { role: 'tab', 'data-tab': id, onclick: () => show(id) }, label)));

  const choose = async (fn, tile) => {
    tile && tile.classList.add('loading');
    try {
      const p = await fn();
      resolveOuter(p);
      overlayClose(p);
    } catch (err) {
      fail(err);
      tile && tile.classList.remove('loading');
    }
  };

  const grid = (items, onPick, empty) => items.length
    ? el('div', { class: 'pick-grid' }, items.map((it) => {
      const tile = el('button', { class: 'pick', title: it.title || '', onclick: () => onPick(it, tile) }, el('img', { src: it.thumb, alt: it.title || '', loading: 'lazy' }), it.caption ? el('small', {}, it.caption) : null);
      return tile;
    }))
    : el('p', { class: 'muted empty-small' }, empty);

  const panels = {
    async site() {
      const imgs = await api('GET', `/api/sites/${d}/images`);
      return grid(imgs.map((i) => ({ ...i, thumb: i.url })), (it) => choose(async () => it.path), 'This site has no images yet.');
    },
    async bank(category = '') {
      const data = await api('GET', `/api/images/bank${category ? '?category=' + encodeURIComponent(category) : ''}`);
      const sel = el('select', { onchange: async () => content.replaceChildren(await panels.bank(sel.value)) },
        el('option', { value: '' }, 'All categories'), data.categories.map((c) => el('option', { value: c, selected: c === category }, c)));
      return el('div', {}, el('div', { class: 'row' }, sel, el('span', { class: 'muted' }, `${data.images.length} images`)),
        grid(data.images.map((i) => ({ ...i, thumb: i.url, caption: i.category })), (it, tile) => choose(async () => (await api('POST', `/api/sites/${d}/images`, { source: 'bank', bankPath: it.bankPath })).path, tile), 'The bank is empty. Search online or upload images.'));
    },
    async online() {
      const q = el('input', { value: state.site.imageQuery || '', placeholder: 'e.g. coffee, beach, office' });
      const results = el('div', {});
      const search = async (e) => {
        e && e.preventDefault();
        results.replaceChildren(el('p', { class: 'muted' }, 'Searching…'));
        try {
          const data = await api('GET', `/api/images/search?q=${encodeURIComponent(q.value)}`);
          results.replaceChildren(
            data.source === 'picsum' ? el('p', { class: 'muted small' }, 'Showing random Picsum photos. Add UNSPLASH_ACCESS_KEY to .env for keyword search.') : null,
            grid(data.results.map((r) => ({ ...r, title: r.credit, caption: r.credit })), (it, tile) =>
              choose(async () => (await api('POST', `/api/sites/${d}/images`, { source: 'online', url: it.full, downloadLocation: it.downloadLocation, category: slugify(q.value) || 'online', name: slugify(q.value) || 'online' })).path, tile), 'No results.'));
        } catch (err) {
          results.replaceChildren(el('p', { class: 'error' }, err.message));
        }
      };
      const form = el('form', { class: 'row', onsubmit: search }, q, el('button', { class: 'btn primary small', type: 'submit' }, 'Search'));
      search();
      return el('div', {}, form, results);
    },
    async upload() {
      const file = el('input', { type: 'file', accept: 'image/*', multiple: true });
      const cat = el('input', { value: 'uploads', placeholder: 'Category' });
      const status = el('p', { class: 'muted' }, 'Uploaded images are added to the image bank and the first one is used here.');
      const form = el('form', {
        class: 'stack',
        onsubmit: async (e) => {
          e.preventDefault();
          if (!file.files.length) return toast('Choose a file first', 'error');
          const fd = new FormData();
          for (const f of file.files) fd.append('images', f);
          fd.append('category', cat.value || 'uploads');
          status.textContent = 'Uploading…';
          choose(async () => {
            const saved = await api('POST', '/api/images/upload', fd);
            return (await api('POST', `/api/sites/${d}/images`, { source: 'bank', bankPath: saved[0].bankPath })).path;
          });
        },
      },
      el('label', { class: 'field' }, 'Image files', file),
      el('label', { class: 'field' }, 'Bank category', cat),
      status,
      el('button', { class: 'btn primary', type: 'submit' }, 'Upload and use'));
      return form;
    },
  };

  async function show(id) {
    tabBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    content.replaceChildren(el('p', { class: 'muted' }, 'Loading…'));
    try {
      content.replaceChildren(await panels[id]());
    } catch (err) {
      content.replaceChildren(el('p', { class: 'error' }, err.message));
    }
  }

  let overlayClose;
  modal('Choose an image', el('div', {}, tabBar, content), null, { wide: true }).then((v) => resolveOuter(v || null));
  overlayClose = document.querySelector('#modal-root .modal-overlay:last-child').closeWith;
  show('bank');
  return result;
}

route();
