# FSS Solutions website

A copy of the content and design of [fsssolutions.ca](https://www.fsssolutions.ca), with a built-in **drag & drop editor**.
It doesn't need Squarespace, any frameworks, or `npm install`. You only need [Node.js](https://nodejs.org) (version 16 or newer).

## Edit the site

```bash
cd website
node server.js
```

Then open **http://localhost:8080/editor**.

| To do this | Do this |
|---|---|
| Change any text | Click it on the page and type. Select words to make them **bold**, *italic*, or a link. |
| Add a block (heading, text, image, button, gallery, form…) | Drag it from the left panel onto the page. You can also click it to add it after the selected item. |
| Add a whole section (hero, text + image, gallery, contact form…) | Drag it from **Sections** in the left panel. |
| Move things | Drag the **⠿** handle on a block or section. Blocks can move between columns and sections. You can also use the ↑ ↓ buttons. |
| Replace a photo | Drag a photo from your computer onto it, or double-click it. |
| Add photos to a gallery | Drag several photos onto the gallery at once. |
| Colours, layout, columns, background photo | Click a section, then use the right panel. |
| Logo, menu links, fonts, site colours | Click the menu bar at the top of the page, or open the **Site** tab. |
| New page / rename / page address / SEO text | Use **+ Page** in the top bar, or the **Page** tab. |
| Check the phone layout | Click the phone icon in the top bar. |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z (⌘ on Mac) |

Click **Save & Publish** (or press Ctrl+S) when you're done. Saving does three things:

1. writes `content.json`, where all text, images, and settings are stored,
2. keeps a copy of the previous version in `.backups/`,
3. rebuilds the finished website in `dist/`.

Unsaved work is also stored in your browser. If you close the tab without saving, the editor offers to restore it next time.

Uploaded photos go into `assets/uploads/`. Large phone photos are shrunk to 2000 px automatically.

## Publish the site

`dist/` is a plain static website: pre-rendered HTML, so it's fast and Google can read it. You can host it anywhere:

- **Netlify** (free): connect this repository. `netlify.toml` already sets the build (`node build.js`) and the publish folder (`website/dist`).
  Every push rebuilds the site. Point the `fsssolutions.ca` domain to Netlify in its domain settings.
- **Any host or cPanel**: run `node build.js`, then upload the contents of `dist/`.

### Contact form

The form on the About page works with no setup: **Submit** opens the visitor's email app with their message filled in, addressed to Riley@fsssolutions.ca.
To get submissions sent to you directly, make a free form at [formspree.io](https://formspree.io). In the editor, click the form and paste its address into **Form service address**.

## Files

```
website/
  content.json    ← all site content (the editor edits this)
  editor.html     ← the drag & drop editor
  index.html      ← live preview page used while editing
  server.js       ← local editing server (saving, uploads)
  build.js        ← builds dist/ from content.json
  js/render.js    ← turns content.json into HTML (used everywhere)
  js/editor.js    ← editor logic
  js/site.js      ← mobile menu, form and photo lightbox on the live site
  css/site.css    ← site design
  css/editor.css  ← editor design
  assets/images/  ← photos and logo
```

### Security note

The editing server only listens on your own computer (`localhost`). To use it from other devices on your network, run
`HOST=0.0.0.0 EDITOR_PASSWORD=choose-a-password node server.js`. Don't put the editing server on the public internet. Publish `dist/` instead.
