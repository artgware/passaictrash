[README.md](https://github.com/user-attachments/files/26871444/README.md)
# Passaic Debris Tracker

A volunteer-run, rower-driven debris tracking site for the lower Passaic River
between Wallington and Kearny, NJ. Live at **https://passaictrash.com**.

Rowers tap one of six river zones on a map, pick a debris severity (1 — clean
through 5 — unsafe to row), set the time they actually saw it, and optionally
attach a photo. Reports flow into a shared Google Sheet via an Apps Script
webhook so every rower in the club sees the same data. The site also overlays
a NOAA tide chart and USGS river-flow data so reports can be cross-referenced
to tide phase and freshwater discharge.

## What's in this repo

| File | Purpose |
|---|---|
| `index.html` / `passaic-debris-tracker.html` | The complete app — single-file HTML, no build step. Identical files; `index.html` exists so GitHub Pages serves the app from the repo root. |
| `manifest.webmanifest` | PWA manifest (installable home-screen app). |
| `service-worker.js` | Offline shell, cache strategy, background sync, push notifications. |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | App icons. |
| `apps-script-webhook.gs` | Backend code — paste this into a Google Apps Script project bound to a Google Sheet. |
| `_headers`, `_redirects` | Netlify-only config (MIME type for `.webmanifest`, root → app HTML redirect). Ignored by other hosts. |
| `SETUP.md` | One-time setup of the Google Sheet + Apps Script backend. |
| `PWA_DEPLOY.md` | How to redeploy and how rowers install the app on iPhone / Android. |

## Tech stack

- Vanilla HTML/CSS/JavaScript in a single file — no build, no bundler.
- [Leaflet 1.9.4](https://leafletjs.com/) for the interactive map.
- [Chart.js 4.4.1](https://www.chartjs.org/) for the tide chart and trends.
- [NOAA Tides & Currents API](https://api.tidesandcurrents.noaa.gov/) — station 8519483 (Bergen Point West Reach, Newark Bay).
- [USGS Water Services API](https://waterservices.usgs.gov/) — station 01389500 (Passaic River at Little Falls).
- Google Apps Script + Google Sheet as the shared backend (see `apps-script-webhook.gs`).
- Service worker for offline support, background-sync, and PWA install.

## Hosting

The live site is served by **Netlify**, with DNS pointed by Squarespace. The
`_headers` and `_redirects` files are Netlify config; they're harmless on other
hosts. GitHub Pages can serve the same files from the repo root if enabled
(Settings → Pages → Source: `main` branch, root) — just note that the service
worker uses absolute paths (`/icon-192.png`, etc.) tuned for the apex domain,
so PWA features under `https://artgware.github.io/passaictrash/` would need
the paths in `service-worker.js` and `manifest.webmanifest` made relative
(swap leading `/` for `./`).

## Local development

There is no build step. Open `index.html` directly in a browser, **or** serve
the folder over HTTP so the service worker can register:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Backend setup

See `SETUP.md` for the 5-minute Google Sheet + Apps Script setup. The web app
URL is baked into the HTML at the constant `SHARED_BACKEND_URL`; rotate it
there if the script is ever redeployed under a new URL.

## Contributing

Issues and PRs welcome — open an issue describing the bug or the feature you'd
like to see. Most changes will live in `passaic-debris-tracker.html` /
`index.html`, since the app is single-file by design.

## License

MIT — see `LICENSE`.
