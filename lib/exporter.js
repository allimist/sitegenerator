// Streams a site as a zip. Pages are pre-rendered HTML, so the export works on
// any static host and when opened straight from disk (file://).
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const sites = require('./sites');

function exportSite(domain, res) {
  const site = sites.rebuildSite(domain);
  const root = sites.siteDir(domain);

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
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isDirectory()) walk(full);
      else archive.file(full, { name: `${site.domain}/${rel}` });
    }
  };
  walk(root);
  archive.append(readme(site), { name: `${site.domain}/README.txt` });
  archive.finalize();
}

function readme(site) {
  return `${site.name} (${site.domain})
====================================

Static website. Upload the contents of this folder to any web host.

- site.json            site name, navigation, theme colors and layout
- <page>/content.json  the content of each page (home page: ./content.json)
- <page>/index.html    pre-rendered page (works without JavaScript)
- assets/              styles, scripts, favicon and optimized images
- sitemap.xml          sitemap for search engines (uses https://${site.domain}/)
- robots.txt

You can edit the JSON files directly: when the site is served over http, each
page loads its JSON and re-renders itself if the files changed.
`;
}

module.exports = { exportSite };
