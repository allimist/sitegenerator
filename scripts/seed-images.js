// Fills the image bank with a few images for every preset category.
// Uses Unsplash keyword search when UNSPLASH_ACCESS_KEY is set, Picsum otherwise.
require('dotenv').config({ quiet: true });
const presets = require('../presets/presets.json');
const { ensureBankImages } = require('../lib/images');

const PER_CATEGORY = Number(process.argv[2]) || 10;

(async () => {
  for (const p of presets) {
    const imgs = await ensureBankImages(p.id, p.imageQuery, PER_CATEGORY);
    console.log(`${p.id.padEnd(12)} ${imgs.length} images`);
  }
})();
