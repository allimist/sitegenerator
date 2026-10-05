# Site Generator

A local tool for generating small, mobile-friendly websites. Every page's content lives in a JSON file, so sites are easy to edit by hand or through the built-in admin panel.

- **One-click sites:** fill in a form, or press **🎲 Random** to start from one of 10 business presets.
- **Random design:** each site gets a random color palette (contrast-checked), font pair and layout.
- **JSON content:** each page is a folder with an `index.html` that renders its `content.json`.
- **Admin panel:** edit sections, add/clone/rename/reorder/delete pages, tweak the theme, preview on desktop or mobile.
- **Images:** a shared local image bank, uploads, and online search (Unsplash, with Picsum as a fallback).
- **Export:** download any site as a ZIP that works on any static host, or opened straight from disk.

No build step and no database: plain Node.js + Express, vanilla HTML/CSS/JS.

## Quick start

Requires Node.js 18 or newer.

```bash
git clone https://github.com/allimist/sitegenerator.git
cd sitegenerator
npm install
npm start
```

Open **http://localhost:3000/admin/**. Press **Ctrl+C** to stop.

### Optional

| What | How |
|---|---|
| Keyword image search | `cp .env.example .env`, then set `UNSPLASH_ACCESS_KEY` ([get a free key](https://unsplash.com/developers)). Without it, online images are random Picsum photos. |
| Pre-fill the image bank | `npm run seed-images` downloads 10 images for each preset, so creating sites is faster. |
| Different port | `PORT=4000 npm start` |

The admin has no login and is meant to run locally only.

## Using it

1. **Create a site.** Click **+ New site**, then press **🎲 Random** or fill in the business type, name, domain, tagline, contact details and pages.
2. **Edit content.** Pick a page on the left, edit its sections in the middle, then click **Save page** (or press Ctrl/Cmd+S). The preview on the right reloads.
3. **Manage pages.** Use the icons next to each page to reorder (↑ ↓), clone (⧉), rename (✎) or delete (🗑). Renaming also renames the folder and updates links on other pages.
4. **Change the look.** **🎲 Re-roll theme** picks new random colors, fonts and layout. You can also set colors and layout options by hand and click **Save theme**.
5. **Export.** **⬇ Export ZIP** on the dashboard or in the editor downloads the finished site.

### Section types

| Section | Fields |
|---|---|
| Hero banner | heading, subheading, image, button |
| Text | heading, text |
| Image + text | heading, text, image, button |
| Feature cards | heading, cards (title, text, optional image) |
| Gallery | heading, images (with lightbox) |
| Call to action | heading, text, button |
| Contact | heading, address, phone, email, hours, plus a contact form |

Button links take a page name (e.g. `contact`) or a full URL.

### Presets

Restaurant, coffee shop, fitness gym, dental clinic, law firm, real estate, photography portfolio, yoga studio, tech startup and travel agency. Each defines sample copy, pages and image keywords in `presets/presets.json`.

### Layout variants

| Part | Options |
|---|---|
| Header | centered, left, split (colored bar) |
| Hero | full image, split, minimal |
| Sections | cards, alternating, stacked |
| Corners | sharp, soft, round |
| Footer | simple, columns |

## Generated site structure

```
sites/my-cafe.com/
  site.json                 name, menu, theme, contact details, footer
  index.html  content.json  home page
  about/
    index.html              page shell (same for every page)
    content.json            page content
  menu/ ...
  assets/
    site.css  site.js       shared renderer
    images/                 images used by this site
```

Exported pages also carry an inline copy of their JSON, so they render when opened from disk (`file://`). When served over http, the JSON files are loaded instead, so edits to them take effect.

## Project structure

```
server.js              Express app: API routes + static files
lib/
  sites.js             create/read/update sites and pages, clone, rename
  theme.js             random palette, fonts and layout
  images.js            image bank, uploads, Unsplash/Picsum search
  exporter.js          ZIP export
templates/             page shell, site.css and site.js copied into each site
presets/presets.json   the 10 business presets
admin/                 admin panel (single page app)
scripts/seed-images.js fills the image bank
sites/                 generated sites (git-ignored)
image-bank/            shared images (git-ignored)
```

`templates/site.css` and `templates/site.js` are copied into every site when the server starts, so template changes apply to all sites.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/presets`, `/api/presets/random` | list presets / pick one at random |
| GET, POST | `/api/sites` | list sites / create a site |
| GET, PUT, DELETE | `/api/sites/:domain` | read / update / delete a site |
| POST | `/api/sites/:domain/theme/randomize` | new random theme |
| GET | `/api/sites/:domain/export` | download ZIP |
| POST | `/api/sites/:domain/pages` | add a page |
| GET, PUT, DELETE | `/api/sites/:domain/pages/:slug` | read / save / delete a page |
| POST | `/api/sites/:domain/pages/:slug/clone` | clone a page (`{ newSlug, title }`) |
| POST | `/api/sites/:domain/pages/:slug/rename` | rename a page (`{ newSlug, title }`) |
| GET, POST | `/api/sites/:domain/images` | list site images / add one from the bank or online |
| GET | `/api/images/bank?category=` | list bank images |
| GET | `/api/images/search?q=` | search online images |
| POST | `/api/images/upload` | upload images to the bank (multipart, field `images`) |

## Notes

- Exported sites load fonts from Google Fonts and fall back to system fonts when offline.
- The contact form opens the visitor's email app (`mailto:`); there is no form backend.
- Domains and page names are sanitized and every file path is checked to stay inside `sites/`.
