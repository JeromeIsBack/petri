# Prism — a no-AI science buddy PWA

A light, glassmorphic, installable web app. It shows real science one **specimen** at a time — a plain-language snippet drawn from a real paper — over a soft aurora background with frosted glass panels and a spectral "prism edge" as its signature.

## What changed in this version

- **New look:** light glassmorphism (frosted white panels over an aurora gradient), Fraunces + Hanken Grotesk + IBM Plex Mono, and the prism-edge accent. New **Prism** wordmark and light app icon.
- **Live data moved to OpenAlex.** The old "signal lost" errors came from Semantic Scholar not reliably allowing browser (CORS) requests. OpenAlex sends proper CORS headers and needs no API key, so **Ask** and **rabbit-hole** now work directly from the browser. Snippets come from the paper's abstract (first sentence or two) instead of Semantic Scholar's one-line TLDR — the honest trade for reliability.
- **Read the report + save it.** Every specimen now has a **Read report** button that opens the actual paper (open-access PDF when available, otherwise the DOI/landing page), and the paper title links to it too. **Save** stores the whole record — including that link — so saved items stay clickable and readable offline.

## Live vs. pooled

- **Ask** and **Rabbit hole** are *live* against OpenAlex — always current, no rebuild ever.
- **Random** and **Daily** read the bundled `pool.json` (a static snapshot) and work fully offline.
- **Saved** and the streak/counter live on the device.

There is **no server**. The only thing that pre-fetches data is `generate-pool.mjs`, run on your machine as a build step.

## Set your email (optional, 10 seconds)

OpenAlex serves faster if you identify yourself (its "polite pool"). Put your email in two places:
- `index.html` → `const MAILTO = "you@example.com";`
- when generating the pool → `OA_MAILTO=you@example.com node generate-pool.mjs`

It works without this, just on the slower shared pool.

## Run it

Any static host works. Locally:

```bash
cd prism
python3 -m http.server 8000     # or: npx serve
# open http://localhost:8000
```

Install/PWA needs HTTPS (or localhost). Deploy the folder as-is to Netlify, Cloudflare Pages, GitHub Pages, Vercel, etc.

## Refresh the pool (Random + Daily)

```bash
node generate-pool.mjs                       # Node 18+
# or, politely:  OA_MAILTO=you@example.com node generate-pool.mjs
```

This pulls real specimens from OpenAlex across the `TOPICS` list and overwrites `pool.json`. After regenerating, bump `CACHE = "prism-v1"` → `"prism-v2"` in `service-worker.js` so installed apps pick up the new data. The seed `pool.json` shipped here is a handful of fun facts so the app runs immediately; regenerate to get real papers with report links.

## Rename it

"Prism" appears in `index.html` (the `<h1>` and `<title>`) and `manifest.webmanifest` (`name` / `short_name`). Swap `icons/` and the `prism-*.png` logo files to rebrand.

## Logo files

- `prism-wordmark.png` — the "Prism" wordmark with spectral underline, transparent
- `prism-wordmark-light.png` — white version for dark backgrounds
- `prism-logo-lockup.png` — wordmark on the aurora-glass background (splash / marketing)
- `icons/` — app icons wired into the manifest

## Files

| File | Role |
|---|---|
| `index.html` | The whole app — UI, styling, logic |
| `pool.json` | Static specimen pool for Random & Daily |
| `generate-pool.mjs` | Build step that fills `pool.json` from OpenAlex |
| `manifest.webmanifest` | Makes it installable |
| `service-worker.js` | Offline caching of the app shell + pool |
| `icons/`, `prism-*.png` | Brand assets |
