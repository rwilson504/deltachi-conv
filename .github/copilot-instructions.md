# Delta Chi Convention Companion Site

Unofficial NE Ohio Alumni companion site for Delta Chi International Conventions,
hosted on GitHub Pages. Currently featuring the **64th International Convention —
Indianapolis, July 22–26, 2026**. Live at https://rwilson504.github.io/deltachi-conv/.

## Architecture: static site, no build step

This is a **plain static site** — no bundler, no framework, no npm, no build/compile
step. Files are served as-is by GitHub Pages. After any edit, the workflow is just
`commit + push`; GitHub Pages redeploys in ~30 seconds. Do **not** introduce a build
system, package manager, or transpilation step unless explicitly asked.

Stack:
- **HTML**: single page, [index.html](../index.html)
- **JS**: vanilla ES, no modules/imports, [assets/app.js](../assets/app.js)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) via CDN (`<script src="https://cdn.tailwindcss.com">`) — utility classes inline in HTML. No Tailwind config file; custom brand colors are defined as CSS variables + helper classes in the `<style>` block of `index.html`.
- **Map**: [Leaflet](https://leafletjs.com/) via unpkg CDN, with free OpenStreetMap tiles (no API key).

## File responsibilities

| File | Purpose | Safe to hand-edit? |
|---|---|---|
| [index.html](../index.html) | Page structure, hero copy, section markup, inline `<style>` | Yes |
| [assets/app.js](../assets/app.js) | Fetches JSON, renders map/cards/roster, filters, countdown | Yes |
| [data/places.json](../data/places.json) | Hotel + food + brewery pins | Yes |
| [data/tour.json](../data/tour.json) | Brew tour stops, transport, charters, payment | Yes |
| [data/roster.json](../data/roster.json) | Attendees — **auto-managed, do NOT hand-edit** | **No** |
| [apps-script/Code.gs](../apps-script/Code.gs) | Google Apps Script bridge (Sheet → GitHub) | Yes (advanced) |
| [apps-script/SETUP.md](../apps-script/SETUP.md) | One-time roster setup + daily workflow docs | Yes |

## How the page renders

`assets/app.js` runs on `DOMContentLoaded` → `init()`:
1. `Promise.all` fetches `data/places.json`, `data/tour.json`, and `data/roster.json`
   (roster is cache-busted with `?_=<timestamp>` and falls back to empty on error).
2. Renders into placeholder containers that exist in the HTML with specific IDs
   (`#map`, `#food-grid`, `#brewery-grid`, `#tour-stops`, `#tour-details`,
   `#attending-table`, etc.). **The HTML holds empty containers; JS injects content.**
   When adding a new dynamic section, add the container + ID in `index.html` and a
   matching `render*()` function in `app.js`.
3. All user-facing strings that come from data are escaped with `escapeHtml()` before
   injection — keep using it for any roster/user-submitted content (XSS safety).

## Data conventions

- **places.json**: array of objects. Each needs `id`, `name`, `category`
  (`"hotel"` | `"food"` | `"brewery"`), `address`, `lat`, `lng`, and `url`.
  Optional: `rating`, `reviews`, `price`, `tag`. Category drives pin color/emoji
  (see `CATEGORY_STYLE` in `app.js`) and which grid it appears in.
- **tour.json**: `stops[]` (each `time`, `name`, `reason`, `lat`, `lng`),
  plus `transport`, `charters[]`, `cost_per_person`, `payment_url`.
- Place data is sourced from the Google Places API (New) via the
  [`goplaces`](https://github.com/steipete/goplaces) CLI, but any source works as
  long as the required fields are present.

## Roster pipeline (privacy-sensitive)

The Roster section is fed by a **private Google Sheet** through a Google Apps Script
that pushes only approved rows to `data/roster.json`. Flow:
Google Form → private Sheet → Apps Script (`Code.gs`) strips private columns and
pushes JSON to GitHub → GitHub Pages rebuilds.

Rules:
- **Never** hand-edit `data/roster.json` — it is overwritten by the script.
- Columns matching `email`, `phone`, `private`, `reviewer`, `timestamp`
  (see `PRIVATE_COLS` in `Code.gs`) are **never** published. Preserve this filtering
  when touching the script. Do not expose private fields on the public site.
- Only rows with `Approved` in `Y/YES/TRUE/1/✓/X` are published.
- Full setup and daily workflow live in [apps-script/SETUP.md](../apps-script/SETUP.md).

## Brand & style conventions

- Brand colors (CSS variables in `index.html`): `--dx-red: #C41E3A`,
  `--dx-buff: #E8C87C`, `--dx-dark: #1a1a1a`. Use helper classes `dx-red`,
  `bg-dx-red`, `bg-dx-dark`, `border-dx-red` rather than hardcoding hex where possible.
- Category accent colors in JS: hotel `#C41E3A`, food green (`#22c55e` / `#16a34a`),
  brewery amber (`#f59e0b` / `#d97706`).
- Tone of copy is casual and brotherly ("a little official Delta Chi stuff").
  Lean warm and informal — this is a companion site for friends, not corporate —
  but this is a preference, not a hard rule; match the surrounding copy.
- Emoji in section headers is intentional and on-brand (🏨 Logistics, 👥 Roster,
  🍺 Brew Tour, 🍴 Eat).

## Per-convention updates (yearly)

Each year the convention moves cities. This site is the **current** guide, not an
archive — old convention info is intentionally not preserved. To roll to a new year:
1. Replace `data/places.json` (new hotel + local food/breweries).
2. Update hero text, dates, and logistics copy in `index.html`.
3. Update or remove `data/tour.json` (brew tour).
4. Update the `HOTEL` lat/lng and any hardcoded dates (e.g. countdown target in
   `renderCountdown()`) in `app.js`.
5. Push.

## Guardrails

- No build tooling or dependencies — keep it a zero-install static site.
- Never publish private roster fields; keep `escapeHtml()` on user-submitted content.
- Don't hand-edit `data/roster.json`.
- Prefer editing existing files over adding new ones; this is a small single-page site.
