// Image bank (shared local library) + online search (Unsplash, Picsum fallback).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const BANK_DIR = path.join(__dirname, '..', 'image-bank');
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const VARIANT_RE = /-\d+\.webp$/i;
const VARIANT_WIDTHS = [480, 960, 1600];
const MAX_SITE_WIDTH = 1600;
const MAX_BANK_WIDTH = 2400;

const slugify = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'misc';

function safeJoin(base, ...parts) {
  const full = path.resolve(base, ...parts);
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Invalid path');
  return full;
}

function listCategories() {
  if (!fs.existsSync(BANK_DIR)) return [];
  return fs
    .readdirSync(BANK_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listBank(category) {
  const cats = category ? [slugify(category)] : listCategories();
  const out = [];
  for (const cat of cats) {
    const dir = safeJoin(BANK_DIR, cat);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f)).sort()) {
      out.push({ category: cat, file, bankPath: `${cat}/${file}`, url: `/image-bank/${cat}/${file}` });
    }
  }
  return out;
}

function extFromType(contentType, fallback = '.jpg') {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
  return map[(contentType || '').split(';')[0].trim()] || fallback;
}

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error('URL is not an image');
  return { buffer: Buffer.from(await res.arrayBuffer()), ext: extFromType(type) };
}

// Saves a buffer into the bank (large photos are scaled down); returns its bank entry.
async function saveToBank(category, buffer, ext, baseName) {
  const cat = slugify(category);
  const dir = safeJoin(BANK_DIR, cat);
  fs.mkdirSync(dir, { recursive: true });
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
  if (ext !== '.gif') {
    try {
      const meta = await sharp(buffer).metadata();
      if (meta.width > MAX_BANK_WIDTH) buffer = await sharp(buffer).rotate().resize({ width: MAX_BANK_WIDTH }).toBuffer();
    } catch {
      throw new Error('File is not a readable image');
    }
  }
  const file = `${slugify(baseName || 'img')}-${hash}${ext}`;
  fs.writeFileSync(path.join(dir, file), buffer);
  return { category: cat, file, bankPath: `${cat}/${file}`, url: `/image-bank/${cat}/${file}` };
}

async function searchOnline(query, page = 1) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (key && query) {
    const url = `https://api.unsplash.com/search/photos?per_page=24&page=${page}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok) throw new Error(`Unsplash error ${res.status}`);
    const data = await res.json();
    return {
      source: 'unsplash',
      results: data.results.map((p) => ({
        id: p.id,
        thumb: p.urls.small,
        full: `${p.urls.raw}&w=1600&q=80&fm=jpg&fit=max`,
        downloadLocation: p.links.download_location,
        alt: p.alt_description || query,
        credit: `${p.user.name} / Unsplash`,
      })),
    };
  }
  // Picsum has no keyword search: return a random page of photos.
  const randomPage = Math.floor(Math.random() * 30) + 1;
  const res = await fetch(`https://picsum.photos/v2/list?page=${randomPage}&limit=24`);
  if (!res.ok) throw new Error(`Picsum error ${res.status}`);
  const list = await res.json();
  return {
    source: 'picsum',
    results: list.map((p) => ({
      id: p.id,
      thumb: `https://picsum.photos/id/${p.id}/400/300`,
      full: `https://picsum.photos/id/${p.id}/1600/1000`,
      alt: query || 'photo',
      credit: `${p.author} / Picsum`,
    })),
  };
}

// Downloads an online image into the bank (Unsplash requires pinging download_location).
async function importOnline({ url, downloadLocation, category, name }) {
  if (!/^https:\/\//i.test(url || '')) throw new Error('Only https image URLs are allowed');
  if (downloadLocation && process.env.UNSPLASH_ACCESS_KEY && /^https:\/\/api\.unsplash\.com\//.test(downloadLocation)) {
    fetch(downloadLocation, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }).catch(() => {});
  }
  const { buffer, ext } = await download(url);
  return saveToBank(category || 'online', buffer, ext, name);
}

// Writes the site copy of an image (max 1600px) plus WebP width variants.
// Returns manifest info: { path, meta: { w, h, v: [widths] } }.
// inPlace: optimizing a file already in the site, so its name/format must not change.
async function processImage(buffer, destDir, base, srcExt, inPlace = false) {
  fs.mkdirSync(destDir, { recursive: true });
  if (srcExt === '.gif') {
    const file = `${base}.gif`;
    if (!fs.existsSync(path.join(destDir, file))) fs.writeFileSync(path.join(destDir, file), buffer);
    const m = await sharp(buffer).metadata().catch(() => ({}));
    return { path: `assets/images/${file}`, meta: { w: m.width, h: m.pageHeight || m.height, v: [] } };
  }
  const meta = await sharp(buffer).rotate().metadata();
  // EXIF orientation 5-8 swaps width/height.
  const [ow, oh] = meta.orientation >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const w = Math.min(ow, MAX_SITE_WIDTH);
  const h = Math.round((oh * w) / ow);
  const keepPng = srcExt === '.png' && (meta.hasAlpha || inPlace);
  const file = `${base}${keepPng ? '.png' : '.jpg'}`;
  const mainPath = path.join(destDir, file);
  if (!fs.existsSync(mainPath) || ow > MAX_SITE_WIDTH) {
    const img = sharp(buffer).rotate().resize({ width: w, withoutEnlargement: true });
    const out = keepPng ? await img.png({ compressionLevel: 9 }).toBuffer() : await img.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    fs.writeFileSync(mainPath, out);
  }
  const widths = [...new Set([...VARIANT_WIDTHS.filter((v) => v < w), w])];
  for (const vw of widths) {
    const vPath = path.join(destDir, `${base}-${vw}.webp`);
    if (!fs.existsSync(vPath)) await sharp(buffer).rotate().resize({ width: vw }).webp({ quality: 78 }).toFile(vPath);
  }
  return { path: `assets/images/${file}`, meta: { w, h, v: widths } };
}

// Copies a bank image into a site's assets/images (optimized); returns { path, meta }.
async function copyBankToSite(bankPath, siteDir) {
  const src = safeJoin(BANK_DIR, bankPath);
  if (!fs.existsSync(src)) throw new Error('Bank image not found');
  const { name, ext } = path.parse(src);
  return processImage(fs.readFileSync(src), path.join(siteDir, 'assets', 'images'), name, ext.toLowerCase());
}

// Creates missing variants for images already in a site; returns the updated manifest.
async function ensureVariants(siteDir, manifest = {}) {
  const dir = path.join(siteDir, 'assets', 'images');
  if (!fs.existsSync(dir)) return manifest;
  const next = {};
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(jpg|png|gif)$/i.test(file) || VARIANT_RE.test(file)) continue;
    const rel = `assets/images/${file}`;
    const known = manifest[rel];
    const { name, ext } = path.parse(file);
    const complete = known && (known.v || []).every((w) => fs.existsSync(path.join(dir, `${name}-${w}.webp`)));
    if (complete) {
      next[rel] = known;
      continue;
    }
    try {
      // Keep the original file name so existing content references stay valid.
      const res = await processImage(fs.readFileSync(path.join(dir, file)), dir, name, ext.toLowerCase(), true);
      if (res.path === rel) next[rel] = res.meta;
    } catch (err) {
      console.warn(`Could not optimize ${rel}: ${err.message}`);
    }
  }
  return next;
}

// Ensures the bank category has at least `count` images, fetching online if needed.
async function ensureBankImages(category, query, count) {
  let images = listBank(category);
  let attempts = 0;
  while (images.length < count && attempts < 2) {
    attempts++;
    try {
      const { results } = await searchOnline(query);
      const needed = count - images.length;
      const picks = results.sort(() => Math.random() - 0.5).slice(0, needed);
      await Promise.all(
        picks.map((r) =>
          importOnline({ url: r.full, downloadLocation: r.downloadLocation, category, name: category }).catch(() => null)
        )
      );
    } catch (err) {
      console.warn(`Could not fetch images for "${category}": ${err.message}`);
      break;
    }
    images = listBank(category);
  }
  return images;
}

module.exports = {
  BANK_DIR,
  slugify,
  listBank,
  listCategories,
  saveToBank,
  searchOnline,
  importOnline,
  copyBankToSite,
  ensureVariants,
  ensureBankImages,
  extFromType,
};
