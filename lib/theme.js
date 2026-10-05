// Random theme generator: color palette, font pair and layout variants.

const FONT_PAIRS = [
  { heading: 'Playfair Display', body: 'Source Sans 3' },
  { heading: 'Montserrat', body: 'Open Sans' },
  { heading: 'Poppins', body: 'Inter' },
  { heading: 'Merriweather', body: 'Lato' },
  { heading: 'Oswald', body: 'Roboto' },
  { heading: 'Raleway', body: 'Nunito' },
  { heading: 'DM Serif Display', body: 'DM Sans' },
  { heading: 'Space Grotesk', body: 'Work Sans' },
];

const LAYOUT_OPTIONS = {
  header: ['centered', 'left', 'split'],
  hero: ['fullImage', 'split', 'minimal'],
  sections: ['cards', 'alternating', 'stacked'],
  radius: ['sharp', 'soft', 'round'],
  footer: ['simple', 'columns'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.random() * (max - min);

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function luminance(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Move lightness (darker on light bg, lighter on dark bg) until contrast passes.
function ensureContrast(h, s, l, bgHex, min, dark) {
  let hex = hslToHex(h, s, l);
  while (contrast(hex, bgHex) < min && l > 0 && l < 100) {
    l += dark ? 3 : -3;
    hex = hslToHex(h, s, l);
  }
  return hex;
}

function randomColors() {
  const hue = Math.floor(rand(0, 360));
  const scheme = pick(['analogous', 'complementary', 'triadic']);
  const offsets = { analogous: [30, -30], complementary: [180, 150], triadic: [120, 240] }[scheme];
  const dark = Math.random() < 0.3;
  const sat = rand(55, 85);

  const bg = dark ? hslToHex(hue, rand(15, 30), rand(7, 12)) : hslToHex(hue, rand(20, 45), rand(96, 99));
  const surface = dark ? hslToHex(hue, rand(15, 30), rand(14, 19)) : '#ffffff';
  const text = dark ? hslToHex(hue, 15, 92) : hslToHex(hue, 25, 14);
  const muted = ensureContrast(hue, 12, dark ? 65 : 42, bg, 4.5, dark);
  const primary = ensureContrast(hue, sat, dark ? 62 : 42, bg, 4.5, dark);
  const secondary = ensureContrast(hue + offsets[0], sat, dark ? 60 : 40, bg, 3, dark);
  const accent = ensureContrast(hue + offsets[1], sat, dark ? 65 : 45, bg, 3, dark);
  // Text on primary buttons: whichever of white/near-black reads better.
  const onPrimary = contrast('#ffffff', primary) >= contrast('#111111', primary) ? '#ffffff' : '#111111';

  return { scheme, mode: dark ? 'dark' : 'light', primary, secondary, accent, bg, surface, text, muted, onPrimary };
}

function randomLayout() {
  const layout = {};
  for (const [key, options] of Object.entries(LAYOUT_OPTIONS)) layout[key] = pick(options);
  return layout;
}

function randomTheme() {
  return { colors: randomColors(), fonts: pick(FONT_PAIRS), layout: randomLayout() };
}

module.exports = { randomTheme, contrast, FONT_PAIRS, LAYOUT_OPTIONS };
