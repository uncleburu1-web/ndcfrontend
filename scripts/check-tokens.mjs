#!/usr/bin/env node
/**
 * Acceptance criterion 1 (feature-specs/01-design-system.md §10):
 * every colour in the UI comes from tokens. Fails if a hex, rgb(), rgba(), hsl() or
 * hsla() colour literal appears in src/ outside src/styles/tokens.css.
 *
 *   npm run check:tokens
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcDir = join(root, "src");
const allowed = join(srcDir, "styles", "tokens.css");
const exts = /\.(css|tsx?|jsx?|html)$/;
const colour = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (exts.test(name)) yield path;
  }
}

const problems = [];
const files = [...walk(srcDir), join(root, "index.html")];
for (const file of files) {
  if (file === allowed) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      // contrast.ts parses colour strings; its regexes are not colour literals.
      if (file.endsWith("contrast.ts")) return;
      for (const m of line.matchAll(colour)) problems.push(`${relative(root, file)}:${i + 1}  ${m[0]}  →  ${line.trim()}`);
    });
}

if (problems.length) {
  console.error(`✗ ${problems.length} colour literal(s) outside tokens.css:\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`✓ No colour literals outside src/styles/tokens.css (${files.length - 1} files checked).`);
