# Petri — a no-AI science buddy PWA

A backend-free installable web app. It shows real science one **specimen** (a plain-language TLDR) at a time, in a glassmorphic "lab" style with a cyan/magenta fluorescence palette.

## What's live vs. what's pooled

- **Ask** and **Rabbit hole** are *live* — they call the Semantic Scholar API directly from the browser, so they're always current. No rebuild needed, ever.
- **Random** and **Daily** read the bundled `pool.json` — a static snapshot. These work fully offline. To refresh them, regenerate the pool (below) and redeploy.
- **Saved** and the streak/counter live on the device (localStorage). Offline by nature.

There is **no server**. The only thing that ever pre-fetches data is `generate-pool.mjs`, which you run on your own machine as a build step.

## Run it

Any static host works (it's just files). Locally:

```bash
cd curio
python3 -m http.server 8000      # or: npx serve
# open http://localhost:8000
```

Service workers and install require **HTTPS** (or localhost). Deploy the folder as-is to Netlify, Cloudflare Pages, GitHub Pages, Vercel, etc.

## Refresh the pool (Random + Daily)

```bash
node generate-pool.mjs           # needs Node 18+ (built-in fetch)
# optional, higher rate limit:  S2_API_KEY=xxxx node generate-pool.mjs
```

This pulls real TLDRs from Semantic Scholar across ~20 topics and overwrites `pool.json`.
After regenerating, **bump `CACHE = "curio-v1"` → `"curio-v2"`** in `service-worker.js` so installed apps pick up the new pool. Do this whenever you like — weekly, monthly, never. The app keeps working untouched in between.

Edit the `TOPICS` array in `generate-pool.mjs` to steer what kind of science fills the pool.

## Two things to know

- **API key & rate limits.** Live search runs keyless, sharing Semantic Scholar's public limit — fine for personal use. Don't put an API key in the front-end (browser code is public); a key only belongs in `generate-pool.mjs`, which runs privately.
- **CORS.** Live Ask/Rabbit-hole depend on Semantic Scholar allowing browser requests. If those ever fail with "Signal lost," the app still works fully via the pooled + saved features; the fix (a proxy, or leaning on the pool) is a small change to the two `fetch` calls in `index.html`.

## Rename it

"Petri" appears in: `index.html` (the `<h1>` wordmark and `<title>`) and `manifest.webmanifest` (`name` / `short_name`). Swap the icons in `icons/` and the `logo-*.png` files to rebrand.

## Logo files

- `logo-mark.png` — the petri-dish mark alone, transparent background
- `logo-lockup.png` — mark + wordmark on navy (for splash / marketing)
- `logo-lockup-transparent.png` — same, transparent background
- `icons/` — app icons wired into the manifest (the mark on navy)

## Files

| File | Role |
|---|---|
| `index.html` | The entire app — UI, styling, and logic in one file |
| `pool.json` | Static specimen pool for Random & Daily (seed data until you regenerate) |
| `generate-pool.mjs` | Build step that fills `pool.json` from Semantic Scholar |
| `manifest.webmanifest` | Makes it installable |
| `service-worker.js` | Offline caching of the app shell + pool |
| `icons/` | App icons |
