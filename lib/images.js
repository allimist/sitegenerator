// Image bank (shared local library) + online search (Unsplash, Picsum fallback).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BANK_DIR = path.join(__dirname, '..', 'image-bank');
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

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

// Saves a buffer into the bank; returns its bank entry.
function saveToBank(category, buffer, ext, baseName) {
  const cat = slugify(category);
  const dir = safeJoin(BANK_DIR, cat);
  fs.mkdirSync(dir, { recursive: true });
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
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

// Copies a bank image into a site's assets/images; returns the site-relative path.
function copyBankToSite(bankPath, siteDir) {
  const src = safeJoin(BANK_DIR, bankPath);
  if (!fs.existsSync(src)) throw new Error('Bank image not found');
  const destDir = path.join(siteDir, 'assets', 'images');
  fs.mkdirSync(destDir, { recursive: true });
  const file = path.basename(src);
  const dest = path.join(destDir, file);
  if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  return `assets/images/${file}`;
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
  ensureBankImages,
  extFromType,
};
