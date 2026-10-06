require('dotenv').config({ quiet: true });
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const sites = require('./lib/sites');
const images = require('./lib/images');
const { exportSite } = require('./lib/exporter');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json({ limit: '2mb' }));

// Wraps handlers so thrown errors (sync or async) become JSON responses.
const h = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (result !== undefined && !res.headersSent) res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) res.status(status).json({ error: err.message || 'Server error' });
  }
};

// ---------- presets ----------
app.get('/api/presets', h(() => sites.getPresets()));
app.get('/api/presets/random', h(() => sites.randomPreset()));

// ---------- sites ----------
app.get('/api/sites', h(() => sites.listSites()));
app.post('/api/sites', h((req) => sites.createSite(req.body || {})));
app.get('/api/sites/:domain', h((req) => sites.getSite(req.params.domain)));
app.put('/api/sites/:domain', h((req) => sites.updateSite(req.params.domain, req.body || {})));
app.delete('/api/sites/:domain', h((req) => (sites.deleteSite(req.params.domain), { ok: true })));
app.post('/api/sites/:domain/theme/randomize', h((req) => sites.randomizeTheme(req.params.domain, req.query.keep)));
app.get('/api/sites/:domain/themes', h((req) => sites.themeCandidates(req.params.domain, req.query.count, req.query.keep)));
app.get('/api/sites/:domain/export', h((req, res) => exportSite(req.params.domain, res)));
app.get('/api/sites/:domain/images', h((req) => sites.listSiteImages(req.params.domain)));
app.post('/api/sites/:domain/images', h((req) => sites.useImage(req.params.domain, req.body || {})));

// ---------- pages ----------
app.post('/api/sites/:domain/pages', h((req) => sites.addPage(req.params.domain, req.body || {})));
app.get('/api/sites/:domain/pages/:slug', h((req) => sites.getPage(req.params.domain, req.params.slug)));
app.put('/api/sites/:domain/pages/:slug', h((req) => sites.savePage(req.params.domain, req.params.slug, req.body)));
app.delete('/api/sites/:domain/pages/:slug', h((req) => (sites.deletePage(req.params.domain, req.params.slug), { ok: true })));
app.post('/api/sites/:domain/pages/:slug/clone', h((req) => sites.clonePage(req.params.domain, req.params.slug, req.body || {})));
app.post('/api/sites/:domain/pages/:slug/rename', h((req) => sites.renamePage(req.params.domain, req.params.slug, req.body || {})));

// ---------- image bank ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)),
});

app.get('/api/images/bank', h((req) => ({ categories: images.listCategories(), images: images.listBank(req.query.category) })));
app.get('/api/images/search', h((req) => images.searchOnline(String(req.query.q || ''), Number(req.query.page) || 1)));
app.post(
  '/api/images/upload',
  upload.array('images'),
  h((req) => {
    if (!req.files || !req.files.length) throw new sites.HttpError(400, 'No valid image files uploaded');
    const category = req.body.category || 'uploads';
    return Promise.all(
      req.files.map((f) =>
        images.saveToBank(category, f.buffer, images.extFromType(f.mimetype, path.extname(f.originalname)), path.parse(f.originalname).name)
      )
    );
  })
);
app.post(
  '/api/images/import',
  h((req) => images.importOnline({ ...req.body, category: req.body.category || 'online' }))
);

// Page rendered with an unsaved theme (?theme=<json>) for the admin theme gallery.
app.get(
  '/preview/:domain',
  h((req, res) => {
    let theme;
    try {
      theme = JSON.parse(String(req.query.theme || ''));
    } catch {
      throw new sites.HttpError(400, 'theme must be JSON');
    }
    res.type('html').send(sites.previewPage(req.params.domain, String(req.query.slug || 'home'), theme));
  })
);

// ---------- static ----------
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/image-bank', express.static(images.BANK_DIR));
app.use('/sites', express.static(sites.SITES_DIR, { extensions: ['html'], cacheControl: false, etag: false }));
app.get('/', (req, res) => res.redirect('/admin/'));

fs.mkdirSync(sites.SITES_DIR, { recursive: true });
fs.mkdirSync(images.BANK_DIR, { recursive: true });

// Rebuild existing sites (optimize images, apply template changes) before serving.
sites.rebuildAll().then(() => {
  app.listen(PORT, () => {
    console.log(`Site generator running: http://localhost:${PORT}/admin/`);
    if (!process.env.UNSPLASH_ACCESS_KEY) console.log('No UNSPLASH_ACCESS_KEY set: online images come from Picsum (no keyword search).');
  });
});
