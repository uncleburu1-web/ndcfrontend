#!/usr/bin/env node
/**
 * Spec 21 §5.2, §18: one-off (re-runnable) extraction of member-facing English into src/i18n/messages/en.json.
 *
 *   node scripts/i18n-extract.mjs [--dry] [files…]
 *
 * Rewrites, in place:
 *   - JSX text (with its {expressions} and inline elements) → {t("key", {…})} or {t.rich("key", {…})};
 *   - text props (title, label, hint, aria-label, placeholder, alt, intro, legend, …) → prop={t("key")};
 *   - prose strings in object literals (labels, messages, word maps) → t("key"); at module level as getters
 *     (`get label() { return t("key"); }`) so they follow the current language;
 *   - validation messages assigned to error objects, and set*Error("…") calls.
 * Keys are `<area>.<slug>`; the same English in the same area shares a key. Context notes go to en.context.json.
 * Repeats until nothing changes (inner elements are handled on the next pass).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");
const EN = path.join(SRC, "i18n/messages/en.json");
const CTX = path.join(SRC, "i18n/messages/en.context.json");
const DRY = process.argv.includes("--dry");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((f) => path.resolve(f));

const messages = fs.existsSync(EN) ? JSON.parse(fs.readFileSync(EN, "utf8")) : {};
const context = fs.existsSync(CTX) ? JSON.parse(fs.readFileSync(CTX, "utf8")) : {};
const byText = new Map(); // area\0message → key
for (const [k, v] of Object.entries(messages)) byText.set(`${k.split(".")[0]}\0${v}`, k);

export const TEXT_PROPS = new Set(["title", "label", "hint", "aria-label", "aria-description", "placeholder", "alt", "intro", "legend",
  "message", "submitLabel", "loadingLabel", "successMessage", "confirmLabel", "cancelLabel", "description", "heading", "blurb", "empty",
  "emptyText", "caption", "help", "lead", "text", "note", "subtitle", "buttonLabel", "actionLabel", "srLabel", "areaLabel", "error"]);
const NOT_TEXT_KEYS = new Set(["className", "to", "href", "path", "icon", "tone", "variant", "size", "kind", "type", "value", "id", "key",
  "code", "slug", "method", "role", "status", "anchor", "field", "name", "native", "rel", "target", "src", "mode", "purpose", "scope",
  "area", "state", "source", "event", "lang", "testid", "query", "param", "format", "accept", "autoComplete", "inputMode", "pattern"]);
const SKIP_TAGS = new Set(["code", "pre", "kbd", "style", "script", "samp"]);
const SKIP_FILES = [/\.test\.tsx?$/, /\.d\.ts$/, /^i18n\//, /^test\//, /^api\/schema/, /^pages\/DesignSystemPage/, /^build-info/];
const ERR_OBJ = /^(e|err|errs|errors|fieldErrors|problems|next|fe|v|issues)$/;

const hasLetters = (s) => /[A-Za-z]{2,}/.test(s);
/** In a conditional inside text, a lone lowercase word ("follower") is a display word too — not a class or key. */
const looseWord = (s) => hasLetters(s) && !/^(https?:|\/|#|\.)/.test(s) && !/^[a-z0-9]+([_-][a-z0-9]+)+$/.test(s) && !/[{}<>=]/.test(s)
  && !/^[a-z]+[A-Z]/.test(s);
const looksProse = (s) => hasLetters(s) && (/\s/.test(s.trim()) || /^[A-Z][a-z’']+[.!?:…]?$/.test(s.trim()) || /[.!?…]$/.test(s.trim()))
  && !/^(https?:|mailto:|\/|#|\.|@)/.test(s.trim()) && !/^[a-z0-9_.-]+$/.test(s.trim()) && !/[{}<>=]|=>|\$\{/.test(s)
  && !/^[A-Z0-9_]+$/.test(s.trim());

function area(file) {
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  const parts = rel.split("/").filter((p) => !["pages", "components", "sections"].includes(p));
  const first = parts.length > 1 ? parts[0] : parts[0].replace(/\.(tsx?|mjs)$/, "");
  return first.replace(/[^A-Za-z0-9]/g, "").replace(/^[A-Z]/, (c) => c.toLowerCase()) || "app";
}

function slug(msg) {
  const words = msg.replace(/<[^>]*>|\{[^}]*\}/g, " ").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).slice(0, 6);
  return words.join("-") || "text";
}

function keyFor(file, msg, where) {
  const a = area(file);
  const hit = byText.get(`${a}\0${msg}`);
  if (hit) return hit;
  let base = `${a}.${slug(msg)}`;
  let k = base;
  for (let n = 2; messages[k] !== undefined && messages[k] !== msg; n++) k = `${base}-${n}`;
  messages[k] = msg;
  context[k] = `${path.relative(ROOT, file)}: ${where}`;
  byText.set(`${a}\0${msg}`, k);
  return k;
}

const esc = (s) => s.replace(/'/g, (m, i, all) => (/[{}<#]/.test(all[i + 1] ?? "") ? "''" : m)).replace(/\{/g, "'{'").replace(/\}/g, "'}'").replace(/</g, "'<'");
const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", hellip: "…", middot: "·", copy: "©", times: "×", rarr: "→", larr: "←", bull: "•", naira: "₦" };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m));

/** JSX whitespace rules: lines trimmed, blank lines dropped, joined with one space; edge spaces on one line kept. */
function jsxText(raw) {
  const s = decode(raw);
  if (!s.includes("\n")) return s;
  const lines = s.split("\n");
  const out = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, " ");
    if (i !== 0) l = l.replace(/^ +/, "");
    if (i !== lines.length - 1) l = l.replace(/ +$/, "");
    if (l) out.push(l);
  });
  return out.join(" ");
}

function placeholderName(expr, used, sf) {
  let n = "";
  let e = expr;
  while (e && (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e))) e = e.expression;
  if (ts.isIdentifier(e)) n = e.text;
  else if (ts.isPropertyAccessExpression(e)) n = e.name.text;
  else if (ts.isCallExpression(e)) {
    const c = e.expression;
    if (ts.isPropertyAccessExpression(c) && ["toLocaleString", "toString", "toFixed", "trim"].includes(c.name.text)) return placeholderName(c.expression, used, sf);
    n = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
  } else if (ts.isElementAccessExpression(e) && ts.isIdentifier(e.expression)) n = e.expression.text;
  n = (n || "v").replace(/[^A-Za-z0-9_]/g, "");
  if (/^\d/.test(n)) n = `v${n}`;
  let out = n;
  for (let i = 2; used.has(out) && used.get(out) !== expr.getText(sf); i++) out = `${n}${i}`;
  used.set(out, expr.getText(sf));
  return out;
}

function main() {
  const files = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?)$/.test(f) && !SKIP_FILES.some((r) => r.test(path.relative(SRC, p).replace(/\\/g, "/")))) files.push(p);
    }
  })(SRC);
  let total = 0;
  for (const file of only.length ? only : files) {
    for (let pass = 0; pass < 8; pass++) {
      const n = processFile(file);
      total += n;
      if (!n) break;
    }
  }
  if (!DRY) {
    const sorted = Object.fromEntries(Object.entries(messages).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(EN, `${JSON.stringify(sorted, null, 2)}\n`);
    fs.writeFileSync(CTX, `${JSON.stringify(Object.fromEntries(Object.entries(context).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
  }
  console.log(`${total} edits; ${Object.keys(messages).length} keys`);
}

function insideFunction(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p) || ts.isClassDeclaration(p)) return true;
  }
  return false;
}

function processFile(file) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const taken = [];
  const free = (s, e) => !taken.some(([a, b]) => s < b && e > a);
  const add = (s, e, text) => {
    if (!free(s, e)) return false;
    taken.push([s, e]);
    edits.push({ s, e, text });
    return true;
  };
  const rel = path.relative(ROOT, file);
  // A file that already uses `t` as a name (a map callback's parameter, a local) gets `tr` instead.
  let clash = false;
  (function scan(n) {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name) && n.name.text === "t") clash = true;
    else ts.forEachChild(n, scan);
  })(sf);
  const already = /import \{[^}]*\bt as tr\b[^}]*\} from "[./]*i18n"/.test(src);
  const T = clash || already ? "tr" : "t";

  /** Code for an expression with its prose string leaves wrapped in t() (conditionals, ??, ||, parentheses, templates). */
  function exprCode(e, where, loose = false) {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      const ok = looksProse(e.text) || (loose && looseWord(e.text));
      return ok ? `${T}(${JSON.stringify(keyFor(file, esc(e.text), where))})` : null;
    }
    if (ts.isTemplateExpression(e)) {
      const used = new Map();
      let msg = esc(e.head.text);
      const vals = [];
      for (const span of e.templateSpans) {
        const pl = pluralOf(span.expression, used);
        if (pl) {
          if (!vals.some(([k]) => k === pl.name)) vals.push([pl.name, pl.code]);
          msg += `${pl.msg}${esc(span.literal.text)}`;
          continue;
        }
        const n = placeholderName(span.expression, used, sf);
        if (!vals.some(([k]) => k === n)) vals.push([n, exprCode(span.expression, where, true) ?? span.expression.getText(sf)]);
        msg += `{${n}}${esc(span.literal.text)}`;
      }
      if (!looksProse(msg.replace(/\{[^}]*\}/g, "x"))) return null;
      const k = keyFor(file, msg, where);
      return `${T}(${JSON.stringify(k)}, { ${vals.map(([n, c]) => (n === c ? n : `${n}: ${c}`)).join(", ")} })`;
    }
    if (ts.isConditionalExpression(e)) {
      const a = exprCode(e.whenTrue, where, loose);
      const b = exprCode(e.whenFalse, where, loose);
      if (a === null && b === null) return null;
      return `${e.condition.getText(sf)} ? ${a ?? e.whenTrue.getText(sf)} : ${b ?? e.whenFalse.getText(sf)}`;
    }
    if (ts.isParenthesizedExpression(e)) {
      const inner = exprCode(e.expression, where, loose);
      return inner === null ? null : `(${inner})`;
    }
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) {
      const r = exprCode(e.right, where, loose);
      return r === null ? null : `${e.left.getText(sf)} ${e.operatorToken.getText(sf)} ${r}`;
    }
    return null;
  }

  /** `n === 1 ? "comment" : "comments"` → an ICU plural on n (§5.3). */
  function pluralOf(e, used) {
    let x = e;
    while (ts.isParenthesizedExpression(x)) x = x.expression;
    if (!ts.isConditionalExpression(x) || !ts.isBinaryExpression(x.condition)) return null;
    const c = x.condition;
    const op = c.operatorToken.kind;
    const isOne = (n) => ts.isNumericLiteral(n) && n.text === "1";
    if (![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(op)) return null;
    const numExpr = isOne(c.right) ? c.left : isOne(c.left) ? c.right : null;
    const lit = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && hasLetters(n.text) ? n.text : null;
    let one = lit(x.whenTrue);
    let other = lit(x.whenFalse);
    if (!numExpr || one === null || other === null) return null;
    if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken) [one, other] = [other, one];
    const name = placeholderName(numExpr, used, sf);
    return { name, code: numExpr.getText(sf), msg: `{${name}, plural, one {${esc(one)}} other {${esc(other)}}}` };
  }

  function childrenCandidate(node) {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName.getText(sf) : "";
    if (SKIP_TAGS.has(tagName)) return;
    const kids = node.children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces && c.text.includes("\n")));
    if (!kids.length) return;
    if (!kids.some((c) => (ts.isJsxText(c) && hasLetters(jsxText(c.text))) || (ts.isJsxExpression(c) && c.expression && ts.isStringLiteral(c.expression) && looksProse(c.expression.text)))) return;
    const used = new Map();
    const values = [];
    const tagCount = new Map();
    let msg = "";
    let rich = false;
    const tagNameFor = (el) => {
      const raw = (ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName).getText(sf).replace(/[^A-Za-z0-9]/g, "").toLowerCase() || "el";
      const n = (tagCount.get(raw) ?? 0) + 1;
      tagCount.set(raw, n);
      return n === 1 ? raw : `${raw}${n}`;
    };
    const simple = (el) => ts.isJsxElement(el) && el.children.every((c) => ts.isJsxText(c) || (ts.isJsxExpression(c) && (!c.expression || !containsJsx(c.expression))));
    for (const c of kids) {
      if (ts.isJsxText(c)) msg += esc(jsxText(c.text));
      else if (ts.isJsxExpression(c)) {
        if (!c.expression) continue;
        const e = c.expression;
        if (ts.isStringLiteral(e)) msg += esc(e.text);
        else if (containsJsx(e)) {
          const n = `x${values.length + 1}`;
          values.push([n, e.getText(sf)]);
          msg += `<${n}/>`;
          rich = true;
        } else {
          const pl = pluralOf(e, used);
          if (pl) {
            if (!values.some(([k]) => k === pl.name)) values.push([pl.name, pl.code]);
            msg += pl.msg;
            continue;
          }
          const n = placeholderName(e, used, sf);
          const code = exprCode(e, "JSX text", true) ?? e.getText(sf);
          if (!values.some(([k]) => k === n)) values.push([n, code]);
          msg += `{${n}}`;
        }
      } else if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) {
        rich = true;
        const n = tagNameFor(c);
        if (simple(c) && c.children.length) {
          const inner = c.children.map((k) => {
            if (ts.isJsxText(k)) return esc(jsxText(k.text));
            if (!k.expression) return "";
            if (ts.isStringLiteral(k.expression)) return esc(k.expression.text);
            const pn = placeholderName(k.expression, used, sf);
            if (!values.some(([kk]) => kk === pn)) values.push([pn, exprCode(k.expression, "JSX text", true) ?? k.expression.getText(sf)]);
            return `{${pn}}`;
          }).join("");
          const open = c.openingElement.getText(sf);
          const close = c.closingElement.getText(sf);
          values.push([n, `(chunks) => ${open}{chunks}${close}`]);
          msg += `<${n}>${inner}</${n}>`;
        } else {
          values.push([n, c.getText(sf)]);
          msg += `<${n}/>`;
        }
      } else return; // fragments etc.: leave
    }
    const textOnly = msg.replace(/<[^>]*>|\{[^}]*\}|'[{}<]'/g, " ");
    if (!hasLetters(textOnly)) return;
    if (/^\s+|\s+$/.test(msg) && kids.length === 1) msg = msg; // single text keeps its edge spaces
    const k = keyFor(file, msg, rich ? "JSX rich text" : "JSX text");
    const args = values.length ? `, { ${values.map(([n, code]) => (n === code ? n : `${JSON.stringify(n).slice(1, -1).match(/^[A-Za-z_]\w*$/) ? n : JSON.stringify(n)}: ${code}`)).join(", ")} }` : "";
    add(kids[0].getStart(sf), kids[kids.length - 1].end, `{${rich ? `${T}.rich` : T}(${JSON.stringify(k)}${args})}`);
  }

  function containsJsx(e) {
    let found = false;
    (function v(n) {
      if (found) return;
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
      else ts.forEachChild(n, v);
    })(e);
    return found;
  }

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) childrenCandidate(node);
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
        && !ts.isStringLiteral(node.expression)) {
      const code = exprCode(node.expression, "JSX expression", true);
      if (code) add(node.expression.getStart(sf), node.expression.end, code);
    }
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (TEXT_PROPS.has(name)) {
        const init = node.initializer;
        if (ts.isStringLiteral(init) && looksProse(init.text)) add(init.getStart(sf), init.end, `{${T}(${JSON.stringify(keyFor(file, esc(init.text), `prop ${name}`))})}`);
        else if (ts.isJsxExpression(init) && init.expression) {
          const code = exprCode(init.expression, `prop ${name}`);
          if (code) add(init.expression.getStart(sf), init.expression.end, code);
        }
      }
    }
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name))) {
      const keyName = node.name.text;
      const obj = node.parent;
      const holder = textHolder(obj);
      if (!NOT_TEXT_KEYS.has(keyName) && (TEXT_PROPS.has(keyName) || /^(words|label|title|message|blurb|hint|text|body|button|heading|summary|description|confirm)$/i.test(keyName) || holder)) {
        const code = exprCode(node.initializer, `object ${keyName}`);
        if (code) {
          if (insideFunction(node)) add(node.initializer.getStart(sf), node.initializer.end, code);
          else add(node.getStart(sf), node.end, `get ${node.name.getText(sf)}() { return ${code}; }`);
        }
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left)
        && ts.isIdentifier(node.left.expression) && ERR_OBJ.test(node.left.expression.text) && insideFunction(node)) {
      const code = exprCode(node.right, "validation message");
      if (code) add(node.right.getStart(sf), node.right.end, code);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(sf) === "document.title") {
      const code = exprCode(node.right, "page title", true);
      if (code) add(node.right.getStart(sf), node.right.end, code);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["withReference", "setTitle", "usePageTitle"].includes(node.expression.text)
        && node.arguments[0]) {
      const code = exprCode(node.arguments[0], `${node.expression.text}()`, true);
      if (code) add(node.arguments[0].getStart(sf), node.arguments[0].end, code);
    }
    // Saved-messages and dialogs: run(fn, "Language saved."), patch(…, "Saved."), onDone("…"), window.confirm("…"), setCodeMsg("…")
    if (ts.isCallExpression(node) && ["run", "patch", "save", "act", "onDone", "window.confirm", "window.prompt", "confirm", "setCodeMsg", "setCodeErr", "setErrors"]
        .includes(node.expression.getText(sf))) {
      for (const a of node.arguments) {
        const code = exprCode(a, `${node.expression.getText(sf)}()`);
        if (code) add(a.getStart(sf), a.end, code);
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^set\w*(Error|Message|Notice|Hint|Status|Problem)$/.test(node.expression.text)
        && node.arguments[0]) {
      const code = exprCode(node.arguments[0], `${node.expression.text}()`);
      if (code) add(node.arguments[0].getStart(sf), node.arguments[0].end, code);
    }
    ts.forEachChild(node, visit);
  }

  /** An object literal whose variable is a word/label map (EVENT_WORDS, ROLE_LABELS…): every prose value is text. */
  function textHolder(obj) {
    for (let p = obj; p; p = p.parent) {
      if (ts.isVariableDeclaration(p)) return /(WORDS|LABELS?|TEXT|NAMES|TITLES|MESSAGES|COPY|HINTS|BLURBS|REASONS|WHY|BLOCKED|EMPTY)$/i.test(p.name.getText(sf));
      if (ts.isFunctionLike(p) || ts.isCallExpression(p)) return false;
    }
    return false;
  }

  visit(sf);
  if (!edits.length) return 0;
  edits.sort((a, b) => b.s - a.s);
  let out = src;
  for (const e of edits) out = out.slice(0, e.s) + e.text + out.slice(e.e);
  if (!/import \{[^}]*\bt\b[^}]*\} from "[./]*i18n"/.test(out)) {
    let relImport = path.relative(path.dirname(file), path.join(SRC, "i18n")).replace(/\\/g, "/");
    if (!relImport.startsWith(".")) relImport = `./${relImport}`;
    const lines = out.split("\n");
    let idx = 0;
    // after the leading comment block and imports
    for (let i = 0; i < lines.length; i++) if (/^import .* from |^import ["']/.test(lines[i])) idx = i + 1;
    // multi-line import: move to the line after its closing
    while (idx < lines.length && idx > 0 && !/;\s*$/.test(lines[idx - 1])) idx++;
    lines.splice(idx, 0, T === "t" ? `import { t } from "${relImport}";` : `import { t as tr } from "${relImport}";`);
    out = lines.join("\n");
  }
  if (!DRY) fs.writeFileSync(file, out);
  else console.log(`${rel}: ${edits.length}`);
  return edits.length;
}

main();
