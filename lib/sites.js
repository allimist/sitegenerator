// Site + page storage: everything lives as JSON files under sites/<domain>/.
const fs = require('fs');
const path = require('path');
const { randomTheme } = require('./theme');
const images = require('./images');

const SITES_DIR = path.join(__dirname, '..', 'sites');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const PRESETS = require('../presets/presets.json');
const RESERVED_SLUGS = new Set(['assets', 'home', 'index']);

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

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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

// Copies the shared renderer (site.css / site.js) into the site.
function syncAssets(domain) {
  const dest = path.join(siteDir(domain), 'assets');
  fs.mkdirSync(path.join(dest, 'images'), { recursive: true });
  for (const f of ['site.css', 'site.js']) fs.copyFileSync(path.join(TEMPLATES_DIR, f), path.join(dest, f));
}

function syncAllAssets() {
  for (const s of listSites()) syncAssets(s.domain);
}

function renderPageHtml(site, slug, content) {
  const root = slug === 'home' ? '.' : '..';
  const title = slug === 'home' ? site.name : `${content.title || slug} | ${site.name}`;
  return fs
    .readFileSync(path.join(TEMPLATES_DIR, 'page.html'), 'utf8')
    .replaceAll('{{ROOT}}', root)
    .replaceAll('{{TITLE}}', escapeHtml(title))
    .replaceAll('{{DESCRIPTION}}', escapeHtml(content.metaDescription || site.tagline || ''))
    .replaceAll('{{LANG}}', escapeHtml(site.lang || 'en'));
}

function writePage(site, slug, content) {
  const dir = pageDir(site.domain, slug);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'content.json'), content);
  fs.writeFileSync(path.join(dir, 'index.html'), renderPageHtml(site, slug, content));
}

// Replaces every "auto" image placeholder with a real image from the bank.
async function resolveAutoImages(pages, preset, domain) {
  let pool = await images.ensureBankImages(preset.id, preset.imageQuery, 10);
  pool = pool.sort(() => Math.random() - 0.5);
  let i = 0;
  const next = () => {
    if (!pool.length) return '';
    const img = pool[i++ % pool.length];
    return images.copyBankToSite(img.bankPath, siteDir(domain));
  };
  const walk = (node) => {
    if (Array.isArray(node)) return node.map((v) => (v === 'auto' ? next() : walk(v)));
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) node[k] = v === 'auto' ? next() : walk(v);
    }
    return node;
  };
  return walk(pages);
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
  for (const p of pages) {
    for (const b of p.blocks) {
      if (b.buttonLink && !/^(https?:|mailto:|tel:|#)/.test(b.buttonLink) && !wanted.has(b.buttonLink)) {
        b.buttonLink = '';
        b.buttonText = '';
      }
    }
  }

  fs.mkdirSync(siteDir(domain), { recursive: true });
  try {
    syncAssets(domain);
    await resolveAutoImages(pages, preset, domain);
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
      createdAt: now,
      updatedAt: now,
    };
    saveSite(site);
    for (const p of pages) {
      writePage(site, p.slug, { title: p.title, metaDescription: tagline, blocks: p.blocks });
    }
    return site;
  } catch (err) {
    fs.rmSync(siteDir(domain), { recursive: true, force: true });
    throw err;
  }
}

function updateSite(domain, patch) {
  const site = getSite(domain);
  for (const key of ['name', 'tagline', 'email', 'phone', 'address', 'lang', 'imageQuery']) {
    if (typeof patch[key] === 'string') site[key] = patch[key].trim();
  }
  if (patch.footer && typeof patch.footer.text === 'string') site.footer.text = patch.footer.text;
  if (patch.theme && patch.theme.colors && patch.theme.layout && patch.theme.fonts) site.theme = patch.theme;
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
  // Titles live in index.html too.
  for (const n of site.nav) writePage(site, n.slug, getPage(domain, n.slug));
  return site;
}

function randomizeTheme(domain) {
  const site = getSite(domain);
  site.theme = randomTheme();
  return saveSite(site);
}

function deleteSite(domain) {
  getSite(domain);
  fs.rmSync(siteDir(domain), { recursive: true, force: true });
}

// ---------- pages ----------

function assertPage(site, slug) {
  if (!site.nav.some((n) => n.slug === slug)) throw new HttpError(404, 'Page not found');
}

function getPage(domain, slug) {
  const site = getSite(domain);
  assertPage(site, slug);
  return readJson(path.join(pageDir(domain, slug), 'content.json'));
}

const BLOCK_TYPES = new Set(['hero', 'text', 'imageText', 'features', 'gallery', 'cta', 'contact']);

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
      { type: 'hero', heading: title, subheading: '', image: '', buttonText: '', buttonLink: '' },
      { type: 'text', heading: '', body: 'Write your content here.' },
    ],
  };
  site.nav.push({ slug, title });
  writePage(site, slug, content);
  saveSite(site);
  return { slug, title };
}

function clonePage(domain, slug, { newSlug, title }) {
  const site = getSite(domain);
  assertPage(site, slug);
  newSlug = cleanSlug(newSlug || `${slug}-copy`);
  assertNewSlug(site, newSlug);
  const content = getPage(domain, slug);
  content.title = String(title || `${content.title} (copy)`).trim();
  const idx = site.nav.findIndex((n) => n.slug === slug);
  site.nav.splice(idx + 1, 0, { slug: newSlug, title: content.title });
  writePage(site, newSlug, content);
  saveSite(site);
  return { slug: newSlug, title: content.title };
}

function renamePage(domain, slug, { newSlug, title }) {
  const site = getSite(domain);
  assertPage(site, slug);
  const entry = site.nav.find((n) => n.slug === slug);
  const content = getPage(domain, slug);
  if (title) {
    entry.title = String(title).trim();
    content.title = entry.title;
  }
  newSlug = slug === 'home' ? 'home' : cleanSlug(newSlug || slug);
  if (newSlug !== slug) {
    assertNewSlug(site, newSlug);
    fs.renameSync(pageDir(domain, slug), pageDir(domain, newSlug));
    entry.slug = newSlug;
    // Update internal links on every page.
    for (const n of site.nav) {
      if (n.slug === newSlug) continue;
      const c = getPageRaw(domain, n.slug);
      let changed = false;
      for (const b of c.blocks) {
        if (b.buttonLink === slug) {
          b.buttonLink = newSlug;
          changed = true;
        }
      }
      if (changed) writePage(site, n.slug, c);
    }
  }
  for (const b of content.blocks) if (b.buttonLink === slug) b.buttonLink = newSlug;
  writePage(site, newSlug, content);
  saveSite(site);
  return { slug: newSlug, title: entry.title };
}

function getPageRaw(domain, slug) {
  return readJson(path.join(pageDir(domain, slug), 'content.json'));
}

function deletePage(domain, slug) {
  const site = getSite(domain);
  assertPage(site, slug);
  if (slug === 'home') throw new HttpError(400, 'The home page cannot be deleted');
  fs.rmSync(pageDir(domain, slug), { recursive: true, force: true });
  site.nav = site.nav.filter((n) => n.slug !== slug);
  saveSite(site);
}

// ---------- images ----------

async function useImage(domain, body) {
  getSite(domain);
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
  return { path: images.copyBankToSite(entry.bankPath, siteDir(domain)) };
}

function listSiteImages(domain) {
  getSite(domain);
  const dir = path.join(siteDir(domain), 'assets', 'images');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
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
  deleteSite,
  syncAssets,
  syncAllAssets,
  getPage,
  savePage,
  addPage,
  clonePage,
  renamePage,
  deletePage,
  useImage,
  listSiteImages,
};
