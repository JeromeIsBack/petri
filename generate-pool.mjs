#!/usr/bin/env node
/* ============================================================
   generate-pool.mjs  —  build pool.json from OpenAlex
   Run:   node generate-pool.mjs
   Then redeploy (and bump CACHE in service-worker.js).

   OpenAlex is open, keyless, and CORS-friendly — the same API
   the app uses live for Ask + rabbit-hole. This build step just
   pre-collects a spread of specimens so Random / Daily work
   offline. It runs on your machine, not on any server.
   ============================================================ */

import { writeFile } from "node:fs/promises";

// ---- config -------------------------------------------------
const MAILTO = process.env.OA_MAILTO || "you@example.com"; // polite pool
const TOPICS = [
  "octopus cognition", "black holes", "CRISPR gene editing", "dark matter",
  "gut microbiome", "quantum computing", "exoplanets", "mycelium networks",
  "neuroplasticity", "deep sea life", "volcanology", "immune system",
  "climate feedback", "graphene materials", "ancient DNA", "bird migration",
  "photosynthesis", "antibiotic resistance", "sleep and memory", "coral reefs"
];
const PER_TOPIC = 10;
const TARGET = 400;
// -------------------------------------------------------------

const SELECT = "id,doi,title,publication_year,authorships,abstract_inverted_index,cited_by_count,primary_location,open_access,best_oa_location";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const authorline = (a = []) => {
  const n = a.map(x => x.author && x.author.display_name).filter(Boolean);
  return !n.length ? "" : (n.length <= 2 ? n.join(" & ") : n[0] + " et al.");
};
function rebuildAbstract(inv) {
  if (!inv) return "";
  const pos = [];
  for (const w in inv) for (const i of inv[w]) pos.push([i, w]);
  pos.sort((a, b) => a[0] - b[0]);
  return pos.map(p => p[1]).join(" ");
}
function firstSentences(t = "", n = 2) {
  t = t.replace(/\s+/g, " ").trim(); if (!t) return "";
  const parts = t.match(/[^.!?]+[.!?]+/g);
  let out = parts ? parts.slice(0, n).join(" ").trim() : t;
  if (out.length > 280) out = out.slice(0, 277).replace(/\s+\S*$/, "") + "…";
  return out;
}
const reportUrl = w =>
  (w.open_access && w.open_access.oa_url) ||
  (w.best_oa_location && (w.best_oa_location.pdf_url || w.best_oa_location.landing_page_url)) ||
  (w.primary_location && w.primary_location.landing_page_url) ||
  w.doi || w.id || null;

async function fetchTopic(topic) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(topic)}`
    + `&filter=has_abstract:true&per_page=${PER_TOPIC}&sort=cited_by_count:desc`
    + `&select=${SELECT}&mailto=${encodeURIComponent(MAILTO)}`;
  const res = await fetch(url);
  if (res.status === 429) { console.log(`  rate-limited on "${topic}", waiting…`); await sleep(3000); return fetchTopic(topic); }
  if (!res.ok) { console.log(`  skip "${topic}" (HTTP ${res.status})`); return []; }
  const { results = [] } = await res.json();
  return results.map(w => {
    const tldr = firstSentences(rebuildAbstract(w.abstract_inverted_index), 2);
    if (!tldr) return null;
    return {
      id: (w.id || "").replace(/^https?:\/\/openalex\.org\//i, ""),
      tldr, title: w.title || "", year: w.publication_year || null,
      authors: authorline(w.authorships || []),
      cites: w.cited_by_count ?? null, url: reportUrl(w),
      oa: !!(w.open_access && w.open_access.is_oa), topic
    };
  }).filter(Boolean);
}

async function main() {
  const seen = new Set(); const specimens = [];
  for (const topic of TOPICS) {
    if (specimens.length >= TARGET) break;
    process.stdout.write(`Fetching "${topic}"… `);
    const batch = await fetchTopic(topic);
    let added = 0;
    for (const s of batch) { if (seen.has(s.id)) continue; seen.add(s.id); specimens.push(s); added++; }
    console.log(`+${added} (total ${specimens.length})`);
    await sleep(400);
  }
  // shuffle so Daily/Random don't cluster by topic
  for (let i = specimens.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [specimens[i], specimens[j]] = [specimens[j], specimens[i]];
  }
  const out = { generated: new Date().toISOString().slice(0, 10), count: specimens.length, source: "OpenAlex", specimens };
  await writeFile("pool.json", JSON.stringify(out, null, 2));
  console.log(`\n✓ Wrote pool.json with ${specimens.length} specimens.`);
  if (!specimens.length) console.log("  (Nothing returned — check your connection.)");
}
main().catch(e => { console.error(e); process.exit(1); });
