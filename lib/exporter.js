// Streams a site as a zip. Each index.html gets an inline JSON snapshot so the
// exported site also works when opened straight from disk (file://).
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const sites = require('./sites');

function inlineData(html, site, content) {
  const json = JSON.stringify({ site, page: content }).replace(/</g, '\\u003c');
  return html.replace('<!--INLINE_DATA-->', `<script type="application/json" id="inline-data">${json}</script>`);
}

function exportSite(domain, res) {
  const site = sites.getSite(domain);
  sites.syncAssets(domain);
  const root = sites.siteDir(domain);
  const pageDirs = new Set(site.nav.map((n) => sites.pageDir(domain, n.slug)));

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('warning', (err) => console.warn('zip warning:', err.message));
  archive.on('error', (err) => {
    console.error('zip error:', err);
    res.destroy(err);
  });

  res.attachment(`${site.domain}.zip`);
  archive.pipe(res);

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      const name = `${site.domain}/${rel}`;
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'index.html' && pageDirs.has(dir)) {
        const content = JSON.parse(fs.readFileSync(path.join(dir, 'content.json'), 'utf8'));
        archive.append(inlineData(fs.readFileSync(full, 'utf8'), site, content), { name });
      } else if (!entry.name.startsWith('.')) {
        archive.file(full, { name });
      }
    }
  };
  walk(root);
  archive.append(readme(site), { name: `${site.domain}/README.txt` });
  archive.finalize();
}

function readme(site) {
  return `${site.name} (${site.domain})
====================================

Static website. Upload this folder to any web host.

- site.json            site name, navigation, theme colors and layout
- <page>/content.json  the content of each page (home page: ./content.json)
- <page>/index.html    page shell that renders content.json with assets/site.js
- assets/images/       images used by the site

Edit the JSON files to change content. Pages also contain an inline copy of
their data so they open directly from disk; when served over http the JSON
files are loaded instead.
`;
}

module.exports = { exportSite };
