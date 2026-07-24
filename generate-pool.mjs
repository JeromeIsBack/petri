#!/usr/bin/env node
/* ============================================================
   generate-pool.mjs
   Build pool.json from real Semantic Scholar TLDRs.

   Run:   node generate-pool.mjs
   Then redeploy (and bump CACHE in service-worker.js so the
   new pool ships to installed apps).

   This is the ONLY piece that talks to Semantic Scholar ahead
   of time. It is a build step, not a running server — run it on
   your own machine whenever you want to refresh Random / Daily.
   ============================================================ */

import { writeFile } from "node:fs/promises";

// ---- config -------------------------------------------------
const TOPICS = [
  "octopus cognition", "black holes", "CRISPR gene editing", "dark matter",
  "gut microbiome", "quantum computing", "exoplanets", "mycelium networks",
  "neuroplasticity", "deep sea life", "volcanoes", "immune system",
  "climate feedback", "materials graphene", "ancient DNA", "bird migration",
  "photosynthesis", "antibiotic resistance", "sleep and memory", "coral reefs"
];
const PER_TOPIC = 12;   // how many to pull per topic
const TARGET = 400;     // stop once the pool reaches this size
const API_KEY = process.env.S2_API_KEY || ""; // optional; higher rate limit
// -------------------------------------------------------------

const FIELDS = "paperId,title,year,authors,tldr,citationCount,url,externalIds";
const headers = API_KEY ? { "x-api-key": API_KEY } : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function authorline(a = []) {
  if (!a.length) return "";
  return a.length <= 2 ? a.map((x) => x.name).join(" & ") : a[0].name + " et al.";
}

async function fetchTopic(topic) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search`
    + `?query=${encodeURIComponent(topic)}&limit=${PER_TOPIC}`
    + `&fields=${FIELDS}`;
  const res = await fetch(url, { headers });
  if (res.status === 429) { console.log(`  rate-limited on "${topic}", waiting…`); await sleep(4000); return fetchTopic(topic); }
  if (!res.ok) { console.log(`  skip "${topic}" (HTTP ${res.status})`); return []; }
  const { data = [] } = await res.json();
  return data
    .filter((p) => p.tldr && p.tldr.text)           // TLDR is the whole point
    .map((p) => ({
      id: p.paperId,
      tldr: p.tldr.text.trim(),
      title: p.title || "",
      year: p.year || null,
      authors: authorline(p.authors),
      cites: p.citationCount ?? null,
      url: p.url || null,
      topic
    }));
}

async function main() {
  const seen = new Set();
  const specimens = [];
  for (const topic of TOPICS) {
    if (specimens.length >= TARGET) break;
    process.stdout.write(`Fetching "${topic}"… `);
    const batch = await fetchTopic(topic);
    let added = 0;
    for (const s of batch) {
      if (seen.has(s.id)) continue;
      seen.add(s.id); specimens.push(s); added++;
    }
    console.log(`+${added} (total ${specimens.length})`);
    await sleep(API_KEY ? 300 : 3500); // be gentle on the shared limit
  }

  // shuffle so Daily/Random don't cluster by topic
  for (let i = specimens.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [specimens[i], specimens[j]] = [specimens[j], specimens[i]];
  }

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    count: specimens.length,
    source: "Semantic Scholar Academic Graph API",
    specimens
  };
  await writeFile("pool.json", JSON.stringify(out, null, 2));
  console.log(`\n✓ Wrote pool.json with ${specimens.length} specimens.`);
  if (!specimens.length) console.log("  (Nothing came back — check your connection or add an S2_API_KEY.)");
}

main().catch((e) => { console.error(e); process.exit(1); });
