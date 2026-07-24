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
  "photosynthesis", "antibiotic resistance", "sleep and memory", "coral reefs",
  "gravitational waves", "tardigrades", "vaccine immunology", "battery chemistry",
  "gene expression", "planetary atmospheres", "superconductivity", "animal navigation",
  "microplastics", "stem cells", "quantum entanglement", "extremophiles",
  "solar physics", "epigenetics", "machine learning", "ocean currents",
  "protein folding", "insect flight", "neutron stars", "photosynthetic bacteria"
];
const PER_TOPIC = 16;
const TARGET = 600;
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
const LABELS = /\b(background|methods?|results?|conclusions?|objectives?|introduction|significance|interpretation|main findings?|findings?|design|funding|purpose|aims?)\b\s*[:.\-—]\s*/gi;
const stripLabels = s => s.replace(LABELS, " ").replace(/\s+/g, " ").trim();
const cap = (s, n = 280) => { s = stripLabels(s); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
function firstSentences(t = "", n = 2) {
  t = t.replace(/\s+/g, " ").trim(); if (!t) return "";
  const p = t.match(/[^.!?]+[.!?]+/g); return cap(p ? p.slice(0, n).join(" ").trim() : t);
}
/* Pull the paper's main finding/conclusion (no AI). */
function conclusionSnippet(text = "") {
  text = text.replace(/\s+/g, " ").trim(); if (!text) return "";
  const label = text.match(/\b(conclusions?|significance|interpretation|main findings?|results?)\b\s*[:.\-—]\s+/i);
  if (label) {
    let tail = text.slice(label.index + label[0].length);
    const next = tail.search(/\b(background|methods?|introduction|objectives?|design|funding|keywords)\b\s*[:.\-—]/i);
    if (next > 40) tail = tail.slice(0, next);
    const s = firstSentences(tail, 2); if (s.length > 25) return s;
  }
  const sents = text.match(/[^.!?]+[.!?]+/g) || [text];
  const CUE = /\b(we (show|find|found|demonstrate|report|conclude|reveal|observe|propose|identify|estimate)|here we|our (results?|findings?|data|study|analysis|work)|these (results?|findings?|data)|results? (show|indicate|suggest|reveal|demonstrate)|conclude that|in conclusion|demonstrat|reveal(s|ed)?|suggests? that|indicat(e|es|ed) that|provides? evidence|taken together|overall)\b/i;
  const BG = /\b(however|little is known|remains? (unclear|unknown|poorly)|it is (unclear|unknown)|has(?:ve)? not (?:yet )?been|few studies|is needed|we (investigated|examined|assessed|studied|aimed|sought|set out)|the (role|effect|impact|purpose|aim) of)\b/i;
  let best = null, score = -1, bi = -1;
  sents.forEach((s, i) => { let sc = 0; if (CUE.test(s)) sc += 3; if (BG.test(s)) sc -= 1.5; sc += i / sents.length; if (sc > score) { score = sc; best = s; bi = i; } });
  if (best && CUE.test(best)) { let out = best.trim(); if (out.length < 90 && sents[bi + 1]) out += " " + sents[bi + 1].trim(); return cap(out); }
  return cap(sents.slice(-2).join(" ").trim());
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
    const tldr = conclusionSnippet(rebuildAbstract(w.abstract_inverted_index));
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
