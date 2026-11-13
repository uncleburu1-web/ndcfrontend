#!/usr/bin/env node
/**
 * check:fonts (spec 21 §11): every character the interface can show — in every catalogue, plus each language's own
 * letters — must fall in the unicode-range of an Archivo face in src/styles/base.css whose file really has it
 * (src/assets/font-coverage.json, made by scripts/font-coverage.py). Otherwise it would render in a fallback font.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(ROOT, "src/styles/base.css"), "utf8");
const coverage = JSON.parse(fs.readFileSync(path.join(ROOT, "src/assets/font-coverage.json"), "utf8"));
const faces = [];
for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
  const url = /url\("([^"]+)"\)/.exec(block)?.[1];
  const ranges = (/unicode-range:\s*([^;]+);/.exec(block)?.[1] ?? "").split(",").map((r) => r.trim()).filter(Boolean).map((r) => {
    const [a, b] = r.replace(/^U\+/i, "").split("-");
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
  if (url && /Archivo Variable/.test(block)) faces.push({ url, ranges, has: new Set(coverage[url] ?? []) });
}
const covered = (cp) => faces.some((f) => f.ranges.some(([a, b]) => cp >= a && cp <= b) && f.has.has(cp));

const LETTERS = { ha: "ɓɗƙƴƁƊƘƳʼ", ig: "ịọụṅỊỌỤṄ", yo: "ẹọṣẸỌṢ̀́̄àáèéìíòóùúńḿ", pcm: "ɛɔÉéÈèÒòÓó" };
const chars = new Map();
const add = (s, where) => {
  for (const ch of s.normalize("NFC")) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || /\s/.test(ch)) continue;
    if (!chars.has(cp)) chars.set(cp, where);
  }
};
for (const [lang, s] of Object.entries(LETTERS)) add(s, `${lang} letters`);
const dir = path.join(ROOT, "src/i18n/messages");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.includes("context"))) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))) add(String(v), `${f} ${k}`);
}
// Arrows (U+2190–21FF) are symbols, not letters: the system font's are fine (they were before spec 21 too).
const symbol = (cp) => cp >= 0x2190 && cp <= 0x21ff;
const missing = [...chars].filter(([cp]) => !covered(cp) && !symbol(cp));
if (missing.length) {
  console.error(`check:fonts: ${missing.length} character(s) would render in a fallback font:`);
  for (const [cp, where] of missing.slice(0, 40)) console.error(`  U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${String.fromCodePoint(cp)}  (${where})`);
  process.exit(1);
}
console.log(`check:fonts OK — ${chars.size} characters covered by ${faces.length} Archivo faces`);
