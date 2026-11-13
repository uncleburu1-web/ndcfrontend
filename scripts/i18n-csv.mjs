#!/usr/bin/env node
/**
 * Spec 21 §15.3 — translators work in spreadsheets.
 *   node scripts/i18n-csv.mjs export ha [out.csv]      key, english, context, translation, status (interface + Clerk)
 *   node scripts/i18n-csv.mjs import ha in.csv [--status machine-draft|translated|reviewed]
 * Import checks every row (known key, same placeholders/tags as English, message parses) and writes
 * src/i18n/messages/<lang>.json and src/i18n/status/<lang>.json. Nothing is written if any row is wrong.
 * "machine-draft" rows never count as reviewed; only a recorded review (Admin → Languages) switches a language on.
 * The backend's messages have their own CSV: python manage.py i18n_export --lang ha.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const I18N = path.join(ROOT, "src/i18n");
const [cmd, lang, file, ...rest] = process.argv.slice(2);
if (!["export", "import"].includes(cmd) || !["ha", "ig", "yo", "pcm"].includes(lang)) {
  console.error("Usage: i18n-csv.mjs export|import <ha|ig|yo|pcm> [file.csv] [--status …]");
  process.exit(2);
}
const read = (f, d = {}) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const en = read(path.join(I18N, "messages/en.json"));
const clerk = Object.fromEntries(Object.entries(read(path.join(I18N, "clerk.en.json"))).map(([k, v]) => [`clerk.${k}`, v]));
const english = { ...en, ...clerk };
const ctx = read(path.join(I18N, "messages/en.context.json"));
const catFile = path.join(I18N, `messages/${lang}.json`);
const statusFile = path.join(I18N, `status/${lang}.json`);
const cat = read(catFile);
const status = read(statusFile);

const csvCell = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

if (cmd === "export") {
  const lines = [["key", "english", "context", "translation", "status"].join(",")];
  for (const [k, v] of Object.entries(english)) {
    const st = status[k] ?? (cat[k] ? "translated" : "new");
    lines.push([k, v, k.startsWith("clerk.") ? "Clerk screen; keep {{ … }} as they are" : ctx[k] ?? "", cat[k] ?? "", st].map(csvCell).join(","));
  }
  const out = `${lines.join("\n")}\n`;
  if (file) fs.writeFileSync(file, out);
  else process.stdout.write(out);
  if (file) console.log(`Wrote ${Object.keys(english).length} rows to ${file}`);
} else {
  const tmp = path.join(os.tmpdir(), `ndc-msg-${process.pid}.mjs`);
  fs.writeFileSync(tmp, ts.transpileModule(fs.readFileSync(path.join(I18N, "message.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText);
  const { parse, signature } = await import(tmp);
  fs.rmSync(tmp);
  const forced = rest.includes("--status") ? rest[rest.indexOf("--status") + 1] : null;
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const head = rows.shift();
  const col = (n) => head.indexOf(n);
  const errors = [];
  let n = 0;
  const sig = (k, m) => (k.startsWith("clerk.") ? (m.match(/\{\{[^}]*\}\}/g) ?? []).map((x) => x.replace(/\s+/g, "").replace(/\|.*\}\}/, "}}")).sort().join(" ")
    : [...signature(parse(m))].sort().join(" "));
  for (const [i, r] of rows.entries()) {
    const k = r[col("key")];
    const tr = (r[col("translation")] ?? "").trim();
    if (!k || !tr) continue;
    if (!(k in english)) { errors.push(`row ${i + 2}: unknown key ${k}`); continue; }
    try {
      if (sig(k, tr) !== sig(k, english[k])) { errors.push(`row ${i + 2} ${k}: placeholders or tags differ from English`); continue; }
    } catch (e) { errors.push(`row ${i + 2} ${k}: ${e.message}`); continue; }
    cat[k] = tr;
    const st = forced ?? r[col("status")];
    status[k] = ["machine-draft", "translated", "reviewed"].includes(st) ? st : "translated";
    n++;
  }
  if (errors.length) {
    console.error(`Nothing imported:\n- ${errors.slice(0, 50).join("\n- ")}`);
    process.exit(1);
  }
  const order = (o) => Object.fromEntries(Object.keys(english).filter((k) => k in o).map((k) => [k, o[k]]));
  fs.writeFileSync(catFile, `${JSON.stringify(order(cat), null, 2)}\n`);
  fs.writeFileSync(statusFile, `${JSON.stringify(order(status), null, 2)}\n`);
  console.log(`${lang}: imported ${n} translations. Run npm run check:i18n.`);
}
