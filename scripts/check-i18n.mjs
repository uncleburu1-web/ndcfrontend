#!/usr/bin/env node
/**
 * check:i18n (spec 21 §5.6). Fails on:
 *   - a key used in code that isn't in en.json, or an en.json key nothing uses (`--fix` removes unused keys);
 *   - a message that doesn't parse (ICU subset, src/i18n/message.ts);
 *   - a translation whose placeholders, plural/select arguments or tags differ from English (any language), and, for
 *     the languages listed in src/i18n/required.json (the ones enabled in production), any missing key or any key
 *     still "needs-update";
 *   - member-facing English written straight into components: JSX text, or a string in a text prop (title, label,
 *     hint, aria-label, placeholder, alt, …) — exceptions in src/i18n/allowlist.json;
 *   - a language chunk over its size budget (gzip).
 * Writes src/i18n/completeness.json (catalogue version, per-language counts) for Admin → Languages (§14).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");
const I18N = path.join(SRC, "i18n");
const FIX = process.argv.includes("--fix");
const LANGS = ["ha", "ig", "yo", "pcm"];
const BUDGET_GZ = 80 * 1024;
const TEXT_PROPS = new Set(["title", "label", "hint", "aria-label", "aria-description", "placeholder", "alt", "intro", "legend", "message",
  "submitLabel", "loadingLabel", "successMessage", "confirmLabel", "cancelLabel", "description", "heading", "blurb", "emptyText", "caption",
  "help", "lead", "note", "subtitle", "buttonLabel", "actionLabel", "srLabel", "areaLabel"]);
const SKIP = [/\.test\.tsx?$/, /\.d\.ts$/, /^i18n\//, /^test\//, /^api\/schema/, /^pages\/DesignSystemPage/];

// The ICU parser, from the app's own source.
const tmp = path.join(os.tmpdir(), `ndc-i18n-message-${process.pid}.mjs`);
fs.writeFileSync(tmp, ts.transpileModule(fs.readFileSync(path.join(I18N, "message.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
const { parse, signature } = await import(tmp);
fs.rmSync(tmp);

const read = (f, fallback = {}) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : fallback);
const en = read(path.join(I18N, "messages/en.json"));
const clerkEn = Object.fromEntries(Object.entries(read(path.join(I18N, "clerk.en.json"))).map(([k, v]) => [`clerk.${k}`, v]));
const allow = read(path.join(I18N, "allowlist.json"), { strings: [], files: [] });
const required = read(path.join(I18N, "required.json"), []);
const problems = [];

// ------------------------------------------------------------------ keys used in code
const used = new Set();
const prefixes = new Set();
const hardcoded = [];
function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}
const looksText = (s) => /[A-Za-z]{2,}/.test(s) && !allow.strings.includes(s.trim());
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const checkText = !SKIP.some((r) => r.test(rel)) && !allow.files.includes(rel);
  const isTest = /\.test\.tsx?$/.test(rel);
  (function visit(n) {
    if (ts.isCallExpression(n) && !isTest) {
      const callee = n.expression.getText(sf);
      if (/^(t|tr)(\.rich)?$/.test(callee) && n.arguments[0]) {
        const a = n.arguments[0];
        if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) used.add(a.text);
        else if (ts.isTemplateExpression(a)) prefixes.add(a.head.text);
      }
      if (callee === "hasOwn" && n.arguments[0] && ts.isTemplateExpression(n.arguments[0])) prefixes.add(n.arguments[0].head.text);
    }
    if (ts.isJsxAttribute(n) && n.name.getText(sf) === "k" && n.initializer && ts.isStringLiteral(n.initializer)) used.add(n.initializer.text);
    if (checkText) {
      if (ts.isJsxText(n)) {
        const text = n.text.replace(/\s+/g, " ").trim();
        if (text && looksText(text)) hardcoded.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: "${text.slice(0, 60)}"`);
      }
      if (ts.isJsxAttribute(n) && TEXT_PROPS.has(n.name.getText(sf)) && n.initializer && ts.isStringLiteral(n.initializer)
          && looksText(n.initializer.text) && /\s|^[A-Z]/.test(n.initializer.text)) {
        hardcoded.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${n.name.getText(sf)}="${n.initializer.text.slice(0, 60)}"`);
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}
// date and wait words are looked up with computed keys
for (const k of Object.keys(en)) if ([...prefixes].some((p) => p && k.startsWith(p))) used.add(k);
for (const k of used) if (!(k in en)) problems.push(`Used in code but missing from en.json: ${k}`);
const unused = Object.keys(en).filter((k) => !used.has(k));
if (unused.length) {
  if (FIX) {
    for (const k of unused) delete en[k];
    fs.writeFileSync(path.join(I18N, "messages/en.json"), `${JSON.stringify(en, null, 2)}\n`);
    const ctxFile = path.join(I18N, "messages/en.context.json");
    const ctx = read(ctxFile);
    for (const k of unused) delete ctx[k];
    fs.writeFileSync(ctxFile, `${JSON.stringify(ctx, null, 2)}\n`);
    console.log(`Removed ${unused.length} unused keys.`);
  } else problems.push(`${unused.length} unused keys in en.json (run npm run check:i18n -- --fix): ${unused.slice(0, 5).join(", ")}…`);
}
for (const h of hardcoded) problems.push(`Hard-coded text (use t()): ${h}`);

// ------------------------------------------------------------------ messages parse; translations match English
const sig = (k, msg) => {
  if (k.startsWith("clerk.")) return new Set((msg.match(/\{\{[^}]*\}\}/g) ?? []).map((m) => m.replace(/\s+/g, "").replace(/\|.*\}\}/, "}}")));
  return signature(parse(msg));
};
const english = { ...en, ...clerkEn };
const enSig = {};
for (const [k, v] of Object.entries(english)) {
  try {
    enSig[k] = [...sig(k, v)].sort().join(" ");
  } catch (e) {
    problems.push(`en ${k}: ${e.message}`);
  }
}
const version = crypto.createHash("sha1").update(JSON.stringify(english)).digest("hex").slice(0, 12);
const completeness = { version, total: Object.keys(english).length, languages: {} };
for (const lang of LANGS) {
  const file = path.join(I18N, `messages/${lang}.json`);
  const cat = read(file);
  const status = read(path.join(I18N, `status/${lang}.json`));
  let translated = 0;
  let reviewed = 0;
  let stale = 0;
  for (const [k, v] of Object.entries(cat)) {
    if (!(k in english)) {
      problems.push(`${lang}: key not in English (remove it): ${k}`);
      continue;
    }
    if (!v) continue;
    try {
      const s = [...sig(k, v)].sort().join(" ");
      // Igbo and Yoruba plurals may have only "other"; the arguments must still match
      if (s !== enSig[k]) problems.push(`${lang} ${k}: placeholders or tags differ from English (${s} ≠ ${enSig[k]})`);
    } catch (e) {
      problems.push(`${lang} ${k}: ${e.message}`);
    }
    translated += 1;
    if (status[k] === "reviewed") reviewed += 1;
    if (status[k] === "needs-update") stale += 1;
  }
  const total = Object.keys(english).length;
  completeness.languages[lang] = { translated, reviewed, needs_update: stale, total, percent: Math.floor((translated * 100) / total) };
  if (required.includes(lang)) {
    const missing = Object.keys(english).filter((k) => !cat[k]);
    if (missing.length) problems.push(`${lang} is enabled but ${missing.length} strings are missing, e.g. ${missing.slice(0, 3).join(", ")}`);
    if (stale) problems.push(`${lang} is enabled but ${stale} strings need updating after English changes`);
  }
  const gz = zlib.gzipSync(fs.readFileSync(file)).length;
  if (gz > BUDGET_GZ) problems.push(`${lang}.json is ${Math.round(gz / 1024)} KB gzipped (budget ${BUDGET_GZ / 1024} KB)`);
}
fs.writeFileSync(path.join(I18N, "completeness.json"), `${JSON.stringify(completeness, null, 2)}\n`);

if (problems.length) {
  console.error(`check:i18n found ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 80)) console.error(`  - ${p}`);
  if (problems.length > 80) console.error(`  … and ${problems.length - 80} more`);
  process.exit(1);
}
console.log(`check:i18n OK — ${Object.keys(en).length} interface keys, ${Object.keys(clerkEn).length} Clerk keys, version ${version}; `
  + LANGS.map((l) => `${l} ${completeness.languages[l].percent}%`).join(", "));
