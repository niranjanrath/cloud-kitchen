# Cloud Kitchen — Ordering PWA

A lightweight, mobile-first food ordering front end for a cloud kitchen.
No backend, no login — customers browse the menu, build a basket, and
share it with you over WhatsApp, SMS, or Email to place the order.

Built with plain HTML, CSS, and JavaScript. Installable as a PWA (works
offline, can be added to the home screen like a native app).

## Features

- **Item List** — browse all items with image, name, price, short description, category filter chips, and search.
- **Item Details** — full description, ingredients, allergens, quantity picker.
- **Basket** — add/update/remove items, live subtotal + delivery + total.
- **Share Basket** — a share sheet (WhatsApp / SMS / Email / more) that opens a pre-filled message with the order summary. Falls back to the native Web Share sheet or clipboard copy where supported.
- **Installable PWA** — a manifest + service worker let people add the app to their home screen and browse the menu offline. On first visit, a banner invites the user to install (with iOS-specific "Add to Home Screen" instructions, since iOS Safari has no native install prompt).
- **No backend** — all menu content lives in `items.json`; the basket is stored in the browser's `localStorage`.

## File structure

```
index.html            The single-page app shell (all views live here)
styles.css            All styling
app.js                Routing, rendering, basket logic, share sheet, install prompt
items.json            Menu data — edit this to add/change items, prices, categories
manifest.json         PWA manifest (name, icons, colors)
service-worker.js      Offline caching
assets/icons/         App icons (192, 512, maskable, apple-touch, favicon)
assets/img/           Menu item illustrations (SVG)
```

## Editing the menu

Everything about the menu is in `items.json` — no code changes needed:

```json
{
  "id": "veg-biryani",
  "name": "Veg Biryani",
  "category": "Main Course",
  "price": 220,
  "shortDescription": "Short line shown in the list",
  "description": "Full description shown on the details page",
  "ingredients": "Comma-separated ingredients",
  "allergens": "Allergen note",
  "image": "assets/img/veg-biryani.svg"
}
```

Add a new item by adding a new object to the `items` array (use a unique
`id`, and point `image` at an SVG/PNG/JPG in `assets/img/`). Add or rename
categories in the top-level `categories` array — the filter chips update
automatically.

Update the WhatsApp number and email address that orders get shared to
in the `shareContacts` block at the top of `items.json`.

## Deploying to GitHub Pages

1. Create a new GitHub repository and push all these files to it (keep them at the repo root, or in a `/docs` folder if you prefer that Pages source).
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose the branch (e.g. `main`) and folder (`/root` or `/docs`), then save.
4. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`.
5. Open that URL on a phone — after a moment, a banner will invite you to add Cloud Kitchen to your home screen. Once added, it opens full-screen like a native app and keeps working with a poor or no connection.

No build step is required — it's static files, so Pages serves it as-is.

## Notes

- The service worker uses **relative paths**, so it works correctly whether the site is hosted at the domain root or a GitHub Pages project subpath (`/repo-name/`).
- If you update `items.json` or any static file after publishing, bump `CACHE_NAME` in `service-worker.js` (e.g. `cloud-kitchen-v2`) so returning visitors pick up the new version instead of a cached copy.
- Menu photos here are simple flat-illustration placeholders (SVG) so the app has zero external dependencies and works fully offline. Swap in real food photography by replacing the files in `assets/img/` and updating the `image` path per item — JPG/PNG/WebP all work.
