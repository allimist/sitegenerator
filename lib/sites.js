// Site + page storage: everything lives as JSON files under sites/<domain>/.
// Every page's index.html is pre-rendered from that JSON (see templates/render.js).
const fs = require('fs');
const path = require('path');
const { randomTheme, validateTheme } = require('./theme');
const images = require('./images');
const R = require('../templates/render');

const SITES_DIR = path.join(__dirname, '..', 'sites');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const PRESETS = require('../presets/presets.json');
const RESERVED_SLUGS = new Set(['assets', 'home', 'index']);
const ASSET_FILES = ['site.css', 'site.js', 'render.js'];
const BLOCK_TYPES = new Set(R.blockTypes);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- validation / paths ----------

function cleanDomain(domain) {
  const d = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) || d.length > 100) {
    throw new HttpError(400, 'Invalid domain (example: my-site.com)');
  }
  return d;
}

function cleanSlug(slug) {
  const s = String(slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s || s.length > 60) throw new HttpError(400, 'Invalid page name (use letters, numbers and dashes)');
  return s;
}

function siteDir(domain) {
  return path.join(SITES_DIR, cleanDomain(domain));
}

function pageDir(domain, slug) {
  return slug === 'home' ? siteDir(domain) : path.join(siteDir(domain), cleanSlug(slug));
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const { esc } = R;

// ---------- presets ----------

function getPresets() {
  return PRESETS;
}

function getPreset(id) {
  return PRESETS.find((p) => p.id === id);
}

function randomPreset() {
  return PRESETS[Math.floor(Math.random() * PRESETS.length)];
}

// ---------- site ----------

function siteExists(domain) {
  return fs.existsSync(path.join(siteDir(domain), 'site.json'));
}

function getSite(domain) {
  const file = path.join(siteDir(domain), 'site.json');
  if (!fs.existsSync(file)) throw new HttpError(404, 'Site not found');
  return readJson(file);
}

function saveSite(site) {
  site.updatedAt = new Date().toISOString();
  writeJson(path.join(siteDir(site.domain), 'site.json'), site);
  return site;
}

function listSites() {
  if (!fs.existsSync(SITES_DIR)) return [];
  return fs
    .readdirSync(SITES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SITES_DIR, d.name, 'site.json')))
    .map((d) => {
      const s = readJson(path.join(SITES_DIR, d.name, 'site.json'));
      return {
        name: s.name,
        domain: s.domain,
        tagline: s.tagline,
        presetId: s.presetId,
        pages: s.nav.length,
        colors: s.theme.colors,
        updatedAt: s.updatedAt,
      };
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

// Copies the shared renderer (site.css / site.js / render.js) into the site.
function syncAssets(domain) {
  const dest = path.join(siteDir(domain), 'assets');
  fs.mkdirSync(path.join(dest, 'images'), { recursive: true });
  for (const f of ASSET_FILES) fs.copyFileSync(path.join(TEMPLATES_DIR, f), path.join(dest, f));
}

// ---------- HTML ----------

const absUrl = (site, rel) => `https://${site.domain}/${rel || ''}`;
const pagePath = (slug) => (slug === 'home' ? '' : `${slug}/`);

function headMeta(site, slug, content) {
  const description = content.metaDescription || site.tagline || '';
  const title = slug === 'home' ? site.name : `${content.title || slug} | ${site.name}`;
  const firstImage = (content.blocks || []).map((b) => b.image).find(Boolean) || Object.keys(site.images || {})[0];
  const tags = [
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(absUrl(site, pagePath(slug)))}">`,
    `<meta name="theme-color" content="${esc(site.theme.colors.primary)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(absUrl(site, pagePath(slug)))}">`,
  ];
  if (firstImage && !/^https?:/.test(firstImage)) {
    tags.push(`<meta property="og:image" content="${esc(absUrl(site, firstImage))}">`);
    tags.push('<meta name="twitter:card" content="summary_large_image">');
  } else {
    tags.push('<meta name="twitter:card" content="summary">');
  }
  return { title, meta: tags.map((t) => `  ${t}\n`).join('') };
}

// opts.preview: render for the admin theme gallery (absolute <base>, no hydration).
function buildPageHtml(site, slug, content, opts = {}) {
  const root = slug === 'home' ? '.' : '..';
  const out = R.renderPage(site, content, { root, current: slug });
  const { title, meta } = headMeta(site, slug, content);
  const base = opts.preview ? `  <base href="/sites/${site.domain}/${pagePath(slug)}">\n` : '';
  return fs
    .readFileSync(path.join(TEMPLATES_DIR, 'page.html'), 'utf8')
    .replaceAll('{{LANG}}', esc(site.lang || 'en'))
    .replaceAll('{{CSS_VARS}}', esc(out.cssVars))
    .replaceAll('{{REV}}', R.hash(site, content))
    .replaceAll('{{STATIC}}', opts.preview ? ' data-static' : '')
    .replaceAll('{{BASE}}', base)
    .replaceAll('{{TITLE}}', esc(title))
    .replaceAll('{{META}}', meta)
    .replaceAll('{{FONTS}}', esc(out.fontsHref))
    .replaceAll('{{BODY_CLASS}}', esc(out.bodyClass))
    .replaceAll('{{ROOT}}', root)
    .replace('{{BODY}}', () => out.bodyHtml);
}

function writePage(site, slug, content) {
  const dir = pageDir(site.domain, slug);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'content.json'), content);
  fs.writeFileSync(path.join(dir, 'index.html'), buildPageHtml(site, slug, content));
}

function faviconSvg(site) {
  const c = site.theme.colors;
  const letter = esc((site.name || '?').trim().charAt(0).toUpperCase() || '?');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${c.primary}"/><text x="32" y="44" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${c.onPrimary || '#fff'}">${letter}</text></svg>\n`;
}

function sitemapXml(site) {
  const lastmod = (site.updatedAt || new Date().toISOString()).slice(0, 10);
  const urls = site.nav
    .map((n) => `  <url><loc>${esc(absUrl(site, pagePath(n.slug)))}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Re-renders every page and the site-level files (nav/theme changes touch every page).
function rebuildSite(domain) {
  const site = getSite(domain);
  const dir = siteDir(domain);
  syncAssets(domain);
  for (const n of site.nav) writePage(site, n.slug, getPageRaw(domain, n.slug));
  fs.writeFileSync(path.join(dir, 'assets', 'favicon.svg'), faviconSvg(site));
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), sitemapXml(site));
  fs.writeFileSync(path.join(dir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${absUrl(site, 'sitemap.xml')}\n`);
  return site;
}

// On startup: optimize images of existing sites and pick up template changes.
async function rebuildAll() {
  for (const s of listSites()) {
    try {
      const site = getSite(s.domain);
      const manifest = await images.ensureVariants(siteDir(s.domain), site.images || {});
      if (JSON.stringify(manifest) !== JSON.stringify(site.images || {})) {
        site.images = manifest;
        writeJson(path.join(siteDir(s.domain), 'site.json'), site);
      }
      rebuildSite(s.domain);
    } catch (err) {
      console.warn(`Could not rebuild ${s.domain}: ${err.message}`);
    }
  }
}

// ---------- create ----------

// Replaces every "auto" image placeholder with an optimized image from the bank.
async function resolveAutoImages(pages, preset, domain) {
  const pool = (await images.ensureBankImages(preset.id, preset.imageQuery, 10)).sort(() => Math.random() - 0.5);
  const copied = [];
  for (const img of pool) {
    try {
      copied.push(await images.copyBankToSite(img.bankPath, siteDir(domain)));
    } catch (err) {
      console.warn(`Skipping image ${img.bankPath}: ${err.message}`);
    }
  }
  const manifest = Object.fromEntries(copied.map((c) => [c.path, c.meta]));
  let i = 0;
  const next = () => (copied.length ? copied[i++ % copied.length].path : '');
  const walk = (node) => {
    if (Array.isArray(node)) return node.map((v) => (v === 'auto' ? next() : walk(v)));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) node[k] = v === 'auto' ? next() : walk(v);
    }
    return node;
  };
  walk(pages);
  return manifest;
}

async function createSite(input) {
  const domain = cleanDomain(input.domain);
  if (siteExists(domain)) throw new HttpError(409, 'A site with this domain already exists');
  const preset = getPreset(input.presetId) || randomPreset();
  const name = String(input.name || '').trim() || preset.name;
  const tagline = String(input.tagline || '').trim() || preset.tagline;
  const email = String(input.email || '').trim() || `hello@${domain}`;
  const phone = String(input.phone || '').trim() || preset.phone;
  const address = String(input.address || '').trim() || preset.address;

  const wanted = new Set(['home', ...(Array.isArray(input.pages) && input.pages.length ? input.pages : preset.pages.map((p) => p.slug))]);
  // Swap the preset's sample identity for the user's values throughout the copy.
  let pagesJson = JSON.stringify(preset.pages.filter((p) => wanted.has(p.slug)));
  for (const [from, to] of [[preset.name, name], [preset.tagline, tagline], [preset.email, email], [preset.phone, phone], [preset.address, address], [preset.domain, domain]]) {
    pagesJson = pagesJson.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
  }
  const pages = JSON.parse(pagesJson);
  // Drop buttons pointing at pages that weren't selected.
  const dropDeadLinks = (node) => {
    if (Array.isArray(node)) return node.forEach(dropDeadLinks);
    if (!node || typeof node !== 'object') return;
    if (node.buttonLink && !/^(https?:|mailto:|tel:|#)/.test(node.buttonLink) && !wanted.has(node.buttonLink)) {
      node.buttonLink = '';
      node.buttonText = '';
    }
    Object.values(node).forEach(dropDeadLinks);
  };
  dropDeadLinks(pages);

  fs.mkdirSync(siteDir(domain), { recursive: true });
  try {
    syncAssets(domain);
    const manifest = await resolveAutoImages(pages, preset, domain);
    const now = new Date().toISOString();
    const site = {
      name,
      domain,
      tagline,
      presetId: preset.id,
      imageQuery: preset.imageQuery,
      email,
      phone,
      address,
      lang: 'en',
      nav: pages.map((p) => ({ slug: p.slug, title: p.title })),
      theme: randomTheme(),
      footer: { text: `© ${new Date().getFullYear()} ${name}. All rights reserved.` },
      images: manifest,
      createdAt: now,
      updatedAt: now,
    };
    saveSite(site);
    for (const p of pages) {
      writeJson(path.join(ensureDir(pageDir(domain, p.slug)), 'content.json'), { title: p.title, metaDescription: tagline, blocks: p.blocks });
    }
    return rebuildSite(domain);
  } catch (err) {
    fs.rmSync(siteDir(domain), { recursive: true, force: true });
    throw err;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- update ----------

function updateSite(domain, patch) {
  const site = getSite(domain);
  for (const key of ['name', 'tagline', 'email', 'phone', 'address', 'lang', 'imageQuery']) {
    if (typeof patch[key] === 'string') site[key] = patch[key].trim();
  }
  if (site.lang && !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(site.lang)) throw new HttpError(400, 'Invalid language code');
  if (patch.footer && typeof patch.footer.text === 'string') site.footer.text = patch.footer.text;
  if (patch.theme) site.theme = validateTheme(patch.theme);
  // Nav: allow reorder / retitle, but the set of pages must stay the same.
  if (Array.isArray(patch.nav)) {
    const current = new Set(site.nav.map((n) => n.slug));
    const next = patch.nav.map((n) => ({ slug: String(n.slug), title: String(n.title || n.slug) }));
    if (next.length !== current.size || !next.every((n) => current.has(n.slug))) {
      throw new HttpError(400, 'Navigation must contain the existing pages');
    }
    site.nav = next;
  }
  saveSite(site);
  return rebuildSite(domain);
}

const KEEP_PARTS = ['colors', 'fonts', 'layout'];
const parseKeep = (keep) => String(keep || '').split(',').filter((k) => KEEP_PARTS.includes(k));

function randomizeTheme(domain, keep) {
  const site = getSite(domain);
  site.theme = randomTheme({ keep: parseKeep(keep), current: site.theme });
  saveSite(site);
  return rebuildSite(domain);
}

// Candidate themes for the gallery; nothing is saved.
function themeCandidates(domain, count = 6, keep) {
  const site = getSite(domain);
  const n = Math.max(1, Math.min(Number(count) || 6, 12));
  return Array.from({ length: n }, () => randomTheme({ keep: parseKeep(keep), current: site.theme }));
}

// A page rendered with a theme that isn't saved (theme gallery previews).
function previewPage(domain, slug, theme) {
  const site = getSite(domain);
  slug = slug || 'home';
  assertPage(site, slug);
  site.theme = validateTheme(theme);
  return buildPageHtml(site, slug, getPageRaw(domain, slug), { preview: true });
}

function deleteSite(domain) {
  getSite(domain);
  fs.rmSync(siteDir(domain), { recursive: true, force: true });
}

// ---------- pages ----------

function assertPage(site, slug) {
  if (!site.nav.some((n) => n.slug === slug)) throw new HttpError(404, 'Page not found');
}

function getPageRaw(domain, slug) {
  return readJson(path.join(pageDir(domain, slug), 'content.json'));
}

function getPage(domain, slug) {
  const site = getSite(domain);
  assertPage(site, slug);
  return getPageRaw(domain, slug);
}

function savePage(domain, slug, content) {
  const site = getSite(domain);
  assertPage(site, slug);
  if (!content || !Array.isArray(content.blocks)) throw new HttpError(400, 'Page content must have a blocks array');
  if (content.blocks.some((b) => !b || !BLOCK_TYPES.has(b.type))) throw new HttpError(400, 'Unknown block type');
  const clean = {
    title: String(content.title || site.nav.find((n) => n.slug === slug).title),
    metaDescription: String(content.metaDescription || ''),
    blocks: content.blocks,
  };
  writePage(site, slug, clean);
  saveSite(site);
  return clean;
}

function assertNewSlug(site, slug) {
  if (RESERVED_SLUGS.has(slug)) throw new HttpError(400, `"${slug}" is a reserved name`);
  if (site.nav.some((n) => n.slug === slug)) throw new HttpError(409, 'A page with this name already exists');
}

function addPage(domain, { slug, title }) {
  const site = getSite(domain);
  slug = cleanSlug(slug || title);
  assertNewSlug(site, slug);
  title = String(title || slug).trim();
  const content = {
    title,
    metaDescription: '',
    blocks: [
      { type: 'hero', heading: title, subheading: '', image: '', imageAlt: '', buttonText: '', buttonLink: '' },
      { type: 'text', heading: '', body: 'Write your content here.' },
    ],
  };
  site.nav.push({ slug, title });
  writeJson(path.join(ensureDir(pageDir(domain, slug)), 'content.json'), content);
  saveSite(site);
  rebuildSite(domain);
  return { slug, title };
}

function clonePage(domain, slug, { newSlug, title }) {
  const site = getSite(domain);
  assertPage(site, slug);
  newSlug = cleanSlug(newSlug || `${slug}-copy`);
  assertNewSlug(site, newSlug);
  const content = getPageRaw(domain, slug);
  content.title = String(title || `${content.title} (copy)`).trim();
  const idx = site.nav.findIndex((n) => n.slug === slug);
  site.nav.splice(idx + 1, 0, { slug: newSlug, title: content.title });
  writeJson(path.join(ensureDir(pageDir(domain, newSlug)), 'content.json'), content);
  saveSite(site);
  rebuildSite(domain);
  return { slug: newSlug, title: content.title };
}

// Rewrites buttonLink values (at any depth, e.g. pricing plans) from one slug to another.
function relink(node, from, to) {
  let changed = false;
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.buttonLink === from) {
      n.buttonLink = to;
      changed = true;
    }
    Object.values(n).forEach(walk);
  };
  walk(node);
  return changed;
}

function renamePage(domain, slug, { newSlug, title }) {
  const site = getSite(domain);
  assertPage(site, slug);
  const entry = site.nav.find((n) => n.slug === slug);
  const content = getPageRaw(domain, slug);
  if (title) {
    entry.title = String(title).trim();
    content.title = entry.title;
  }
  newSlug = slug === 'home' ? 'home' : cleanSlug(newSlug || slug);
  if (newSlug !== slug) {
    assertNewSlug(site, newSlug);
    fs.renameSync(pageDir(domain, slug), pageDir(domain, newSlug));
    entry.slug = newSlug;
    for (const n of site.nav) {
      if (n.slug === newSlug) continue;
      const c = getPageRaw(domain, n.slug);
      if (relink(c, slug, newSlug)) writeJson(path.join(pageDir(domain, n.slug), 'content.json'), c);
    }
  }
  relink(content, slug, newSlug);
  writeJson(path.join(pageDir(domain, newSlug), 'content.json'), content);
  saveSite(site);
  rebuildSite(domain);
  return { slug: newSlug, title: entry.title };
}

function deletePage(domain, slug) {
  const site = getSite(domain);
  assertPage(site, slug);
  if (slug === 'home') throw new HttpError(400, 'The home page cannot be deleted');
  fs.rmSync(pageDir(domain, slug), { recursive: true, force: true });
  site.nav = site.nav.filter((n) => n.slug !== slug);
  saveSite(site);
  rebuildSite(domain);
}

// ---------- images ----------

async function useImage(domain, body) {
  const site = getSite(domain);
  let entry;
  if (body.source === 'bank') {
    entry = { bankPath: String(body.bankPath || '') };
  } else if (body.source === 'online') {
    entry = await images.importOnline({
      url: body.url,
      downloadLocation: body.downloadLocation,
      category: body.category || 'online',
      name: body.name || body.category || 'online',
    });
  } else {
    throw new HttpError(400, 'Unknown image source');
  }
  const res = await images.copyBankToSite(entry.bankPath, siteDir(domain));
  site.images = { ...(site.images || {}), [res.path]: res.meta };
  saveSite(site);
  return { path: res.path, alt: String(body.alt || '') };
}

function listSiteImages(domain) {
  getSite(domain);
  const dir = path.join(siteDir(domain), 'assets', 'images');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f) && !/-\d+\.webp$/i.test(f))
    .map((f) => ({ path: `assets/images/${f}`, url: `/sites/${domain}/assets/images/${f}` }));
}

module.exports = {
  SITES_DIR,
  HttpError,
  cleanDomain,
  siteDir,
  pageDir,
  getPresets,
  getPreset,
  randomPreset,
  listSites,
  getSite,
  createSite,
  updateSite,
  randomizeTheme,
  themeCandidates,
  previewPage,
  deleteSite,
  syncAssets,
  rebuildSite,
  rebuildAll,
  getPage,
  savePage,
  addPage,
  clonePage,
  renamePage,
  deletePage,
  useImage,
  listSiteImages,
};
