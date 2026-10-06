# Site Generator

A local tool for generating small, mobile-friendly websites. Every page's content lives in a JSON file, so sites are easy to edit by hand or through the built-in admin panel.

- **One-click sites:** fill in a form, or press **🎲 Random** to start from one of 10 business presets.
- **Random design:** each site gets a random color palette (contrast-checked), font pair and layout.
- **JSON content:** each page is a folder with an `index.html` built from its `content.json`.
- **SEO-ready:** pages are pre-rendered HTML (readable without JavaScript), with Open Graph tags, canonical URLs, `sitemap.xml`, `robots.txt`, a generated favicon and FAQ structured data.
- **13 section types:** hero, text, image + text, cards, gallery, testimonials, pricing, FAQ, team, call to action, contact, map and video.
- **Optimized images:** resized JPGs plus WebP versions at 480/960/1600px served with `srcset`, and alt text on every image.
- **Admin panel:** edit sections, add/clone/rename/reorder/delete pages, preview on desktop or mobile.
- **Theme gallery:** compare 6 random themes as live previews and apply one, optionally keeping the current colors, fonts or layout.
- **Images:** a shared local image bank, uploads, and online search (Unsplash, with Picsum as a fallback).
- **Export:** download any site as a ZIP that works on any static host, or opened straight from disk.

No build step and no database: plain Node.js + Express, vanilla HTML/CSS/JS, and [sharp](https://sharp.pixelplumbing.com/) for images.

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
| Edit the presets | Change `scripts/build-presets.js`, then run `npm run build-presets`. |

The admin has no login and is meant to run locally only.

## Using it

1. **Create a site.** Click **+ New site**, then press **🎲 Random** or fill in the business type, name, domain, tagline, contact details and pages.
2. **Edit content.** Pick a page on the left, edit its sections in the middle, then click **Save page** (or press Ctrl/Cmd+S). The preview on the right reloads.
3. **Manage pages.** Use the icons next to each page to reorder (↑ ↓), clone (⧉), rename (✎) or delete (🗑). Renaming also renames the folder and updates links on other pages.
4. **Change the look.** **🎨 Choose theme…** shows 6 random themes as live previews of the current page. Tick **Keep colors / fonts / layout** to shuffle only the other parts, then **Use this theme**. **🎲 Re-roll theme** applies one random theme straight away, and you can set colors and layout options by hand and click **Save theme**.
5. **Describe images.** Every image has an **Alt text** field (gallery images too). Unsplash images come with a suggested description.
6. **Export.** **⬇ Export ZIP** on the dashboard or in the editor downloads the finished site.

### Section types

| Section | Fields |
|---|---|
| Hero banner | heading, subheading, image, button |
| Text | heading, text |
| Image + text | heading, text, image, button |
| Feature cards | heading, cards (title, text, optional image) |
| Gallery | heading, images with alt text (opens in a lightbox) |
| Testimonials | heading, quotes (quote, name, role, optional photo; initials are shown otherwise) |
| Pricing table | heading, plans (name, price, period, features one per line, button, "most popular" highlight) |
| FAQ | heading, questions and answers (accordion that works without JavaScript, plus FAQPage structured data) |
| Team | heading, members (name, role, bio, optional photo) |
| Call to action | heading, text, button |
| Contact | heading, address, phone, email, hours, plus a contact form |
| Map | heading, address (Google Maps embed) |
| Video | heading, YouTube or Vimeo link, caption (YouTube uses the privacy-enhanced youtube-nocookie.com) |

Button links take a page name (e.g. `contact`) or a full URL. Sections and list items (cards, plans, questions…) can be reordered with ↑ ↓.

### Presets

Restaurant, coffee shop, fitness gym, dental clinic, law firm, real estate, photography portfolio, yoga studio, tech startup and travel agency. Each preset gives five pages (home, about, services, gallery, contact) with sample copy, testimonials, team, FAQ, a map, image keywords, and pricing for the gym, yoga, startup and photography presets. They are generated into `presets/presets.json` by `scripts/build-presets.js`.

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
  site.json                 name, menu, theme, contact details, footer, image manifest
  index.html  content.json  home page
  about/
    index.html              pre-rendered page
    content.json            page content
  menu/ ...
  sitemap.xml  robots.txt
  assets/
    site.css  render.js  site.js   styles + shared renderer
    favicon.svg                    generated from the site name and primary color
    images/                        name.jpg + name-480/960/1600.webp
```

**How pages stay JSON-driven:** the server builds each `index.html` from `site.json` + `content.json` with `templates/render.js`, so pages have real content for search engines and work without JavaScript or from disk (`file://`). The same renderer runs in the browser: each page loads its JSON files and re-renders only if they changed since the HTML was built (a hash is stored in `data-rev`). Edit a JSON file on your host and the page updates; the admin rebuilds the HTML on every save.

## Project structure

```
server.js              Express app: API routes + static files
lib/
  sites.js             sites and pages: create, save, clone, rename, rebuild HTML, sitemap
  theme.js             random palette, fonts and layout; theme validation
  images.js            image bank, uploads, online search, WebP variants (sharp)
  exporter.js          ZIP export
templates/
  page.html            HTML shell with SEO tags
  render.js            renderer shared by server and browser (all section types)
  site.js              browser: re-render on JSON changes, menu, lightbox
  site.css             styles and layout variants
presets/presets.json   the 10 business presets (generated)
admin/                 admin panel (single page app)
scripts/
  build-presets.js     source of the presets
  seed-images.js       fills the image bank
sites/                 generated sites (git-ignored)
image-bank/            shared images (git-ignored)
```

When the server starts it rebuilds every site: template changes apply everywhere, and images of older sites get their WebP versions.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/presets`, `/api/presets/random` | list presets / pick one at random |
| GET, POST | `/api/sites` | list sites / create a site |
| GET, PUT, DELETE | `/api/sites/:domain` | read / update / delete a site |
| POST | `/api/sites/:domain/theme/randomize?keep=colors,fonts` | new random theme (optionally keeping parts) |
| GET | `/api/sites/:domain/themes?count=6&keep=…` | random theme candidates (not saved) |
| GET | `/preview/:domain?slug=home&theme=<json>` | page rendered with an unsaved theme |
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
- Domains and page names are sanitized, every file path is checked to stay inside `sites/`, and themes are validated (hex colors, known fonts and layouts only).
- Canonical URLs, `og:url` and the sitemap use `https://<domain>/`.
