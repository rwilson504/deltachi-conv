# deltachi-conv

Unofficial brother's guide to Delta Chi International Conventions, hosted on GitHub Pages.

**Live site:** https://rwilson504.github.io/deltachi-conv/

Currently featuring the **64th International Convention — Indianapolis, July 22-26, 2026**.

## What's on the site

- 🗺️ Interactive map of the convention hotel + nearby food and breweries
- 🍴 Curated moderate-priced restaurants within walking distance
- 🍺 Indianapolis brewery list
- 🚌 Friday brew tour itinerary + charter bus operator contacts
- 🏨 Convention logistics (hotel, airport, getting around)

## Editing

It's a static site — no build step. Three things you might want to edit:

| What | Where |
|---|---|
| Add/remove places | `data/places.json` |
| Change brew tour stops or charter list | `data/tour.json` |
| Change page text/colors/layout | `index.html` and `assets/app.js` |

After editing, just commit + push. GitHub Pages re-deploys in ~30 seconds.

## Per-convention updates

Each year the convention moves to a new city. To update for the new year:
1. Update `data/places.json` with new hotel + new local food/breweries (use `goplaces` CLI or any source you like — must include `lat`, `lng`, `category`, `name`, `address`)
2. Update hero text + dates in `index.html`
3. Update the brew tour data in `data/tour.json` (or remove that section if no tour that year)
4. Push — done.

Old convention info is intentionally not preserved. This is the *current* convention guide, not an archive.

## Data sources

- Place data: Google Places API (New) via [`goplaces`](https://github.com/steipete/goplaces) CLI
- Map tiles: OpenStreetMap (free, no API key)
- Map library: [Leaflet](https://leafletjs.com/)
- Styling: [Tailwind CSS](https://tailwindcss.com/) via CDN

## License

MIT
