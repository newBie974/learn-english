import { readFileSync } from "node:fs";

const errors = [];
const load = (p) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url)));
const fail = (f, msg) => errors.push(`${f}: ${msg}`);

function checkPairs(file, rows, { needTr = false } = {}) {
  if (!Array.isArray(rows)) return fail(file, "doit être un tableau");
  const seen = new Set();
  rows.forEach((r, i) => {
    if (!r.en || !r.fr) fail(file, `#${i} en/fr manquant`);
    if (needTr && !r.tr) fail(file, `#${i} (${r.en}) tr manquant`);
    if (seen.has(r.en)) fail(file, `doublon en="${r.en}"`);
    seen.add(r.en);
  });
}

// words.json
const words = load("words.json");
if (words.length !== 3000) fail("words.json", `attendu 3000, reçu ${words.length}`);
const seenWords = new Set();
words.forEach((w, i) => {
  if (!w.en || !w.fr) fail("words.json", `#${i} en/fr manquant`);
  if (!(w.lvl >= 1 && w.lvl <= 6)) fail("words.json", `#${i} (${w.en}) lvl hors 1-6`);
  if (seenWords.has(w.en)) fail("words.json", `doublon en="${w.en}"`);
  seenWords.add(w.en);
});

// verbs.json — fr = "prétérit · participe passé"
const verbs = load("verbs.json");
checkPairs("verbs.json", verbs, { needTr: true });
verbs.forEach((v) => { if (v.fr && !v.fr.includes(" · ")) fail("verbs.json", `(${v.en}) fr sans " · "`); });

// phrasal.json + expressions.json
const phrasal = load("phrasal.json");
const expressions = load("expressions.json");
checkPairs("phrasal.json", phrasal);
checkPairs("expressions.json", expressions);

// sentences.json
const sentences = load("sentences.json");
const ids = new Set();
sentences.forEach((s, i) => {
  if (ids.has(s.id)) fail("sentences.json", `doublon id=${s.id}`);
  ids.add(s.id);
  if (!s.text) { fail("sentences.json", `#${i} (id ${s.id}) text manquant`); }
  else {
    const blanks = (s.text.match(/___/g) || []).length;
    if (blanks !== 1) fail("sentences.json", `#${i} (id ${s.id}) ${blanks} trous au lieu de 1`);
  }
  if (!Array.isArray(s.options) || s.options.length !== 3) { fail("sentences.json", `#${i} (id ${s.id}) options ≠ 3`); }
  else {
    if (!s.options.includes(s.answer)) fail("sentences.json", `#${i} (id ${s.id}) answer absent des options`);
    if (new Set(s.options).size !== s.options.length) fail("sentences.json", `#${i} (id ${s.id}) options en double`);
  }
});

if (errors.length) {
  console.error(`❌ ${errors.length} erreur(s) :`);
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("✅ Données valides : words", words.length, "· verbs", verbs.length, "· phrasal", phrasal.length, "· expr", expressions.length, "· sentences", sentences.length);
