/**
 * Spec 21 §5.3: a subset of ICU MessageFormat, parsed once per message and cached.
 *   "Hello, {name}"                                   placeholders
 *   "{count, plural, one {# comment} other {# comments}}"   plurals (Intl.PluralRules; # is the formatted number)
 *   "{kind, select, rally {Rally} other {Event}}"      selects
 *   "Read <link>the rules</link>", "<icon/> Saved"     tags, rendered by components the caller gives (t.rich)
 * Literal braces or "<" are written '{', '}' and '<' (ICU quoting). A bad message throws at parse time; check:i18n
 * parses every catalogue in CI, so that never reaches a page.
 */
export type Node =
  | { k: "text"; v: string }
  | { k: "arg"; name: string }
  | { k: "hash" }
  | { k: "plural" | "select"; name: string; options: Record<string, Node[]> }
  | { k: "tag"; name: string; children: Node[] | null };

export class MessageError extends Error {}

export function parse(src: string): Node[] {
  let i = 0;
  function text(stop: string, inPlural: boolean): Node[] {
    const out: Node[] = [];
    let buf = "";
    const flush = () => {
      if (buf) out.push({ k: "text", v: buf });
      buf = "";
    };
    while (i < src.length) {
      const c = src[i];
      if (c === "'" && (src[i + 1] === "{" || src[i + 1] === "}" || src[i + 1] === "<" || src[i + 1] === "#") && src[i + 2] === "'") {
        buf += src[i + 1];
        i += 3;
        continue;
      }
      if (c === "'" && src[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (stop.includes(c) && (c !== "<" || src[i + 1] === "/")) break;
      if (c === "#" && inPlural) {
        flush();
        out.push({ k: "hash" });
        i += 1;
        continue;
      }
      if (c === "{") {
        flush();
        out.push(arg(inPlural));
        continue;
      }
      if (c === "<") {
        flush();
        out.push(tag(inPlural));
        continue;
      }
      if (c === "}") throw new MessageError(`Unexpected } at ${i} in: ${src}`);
      buf += c;
      i += 1;
    }
    flush();
    return out;
  }
  function name(): string {
    const m = /^\s*([A-Za-z_][\w]*)\s*/.exec(src.slice(i));
    if (!m) throw new MessageError(`Expected a name at ${i} in: ${src}`);
    i += m[0].length;
    return m[1];
  }
  function arg(inPlural: boolean): Node {
    i += 1; // {
    const n = name();
    if (src[i] === "}") {
      i += 1;
      return { k: "arg", name: n };
    }
    if (src[i] !== ",") throw new MessageError(`Expected , or } at ${i} in: ${src}`);
    i += 1;
    const kind = name();
    if (kind !== "plural" && kind !== "select") throw new MessageError(`Unknown format "${kind}" in: ${src}`);
    if (src[i] !== ",") throw new MessageError(`Expected , at ${i} in: ${src}`);
    i += 1;
    const options: Record<string, Node[]> = {};
    for (;;) {
      while (/\s/.test(src[i] ?? "")) i += 1;
      if (src[i] === "}") {
        i += 1;
        break;
      }
      const m = /^(=\d+|[A-Za-z_]\w*)\s*\{/.exec(src.slice(i));
      if (!m) throw new MessageError(`Expected an option at ${i} in: ${src}`);
      i += m[0].length;
      options[m[1]] = text("}", kind === "plural" || inPlural);
      if (src[i] !== "}") throw new MessageError(`Unclosed option in: ${src}`);
      i += 1;
    }
    if (!options.other) throw new MessageError(`"${kind}" needs an "other" option in: ${src}`);
    return { k: kind, name: n, options };
  }
  function tag(inPlural: boolean): Node {
    const m = /^<([A-Za-z_][\w]*)\s*(\/?)>/.exec(src.slice(i));
    if (!m) throw new MessageError(`Bad tag at ${i} in: ${src}`);
    i += m[0].length;
    if (m[2]) return { k: "tag", name: m[1], children: null };
    const children = text("<", inPlural);
    const close = `</${m[1]}>`;
    if (src.slice(i, i + close.length) !== close) throw new MessageError(`Missing ${close} in: ${src}`);
    i += close.length;
    return { k: "tag", name: m[1], children };
  }
  const nodes = text("", false);
  if (i < src.length) throw new MessageError(`Unexpected text at ${i} in: ${src}`);
  return nodes;
}

/** Names a message needs (placeholders, plural/select arguments, tags) — check:i18n compares them across languages. */
export function signature(nodes: Node[], acc = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.k === "arg") acc.add(`{${n.name}}`);
    else if (n.k === "plural" || n.k === "select") {
      acc.add(`{${n.name}}`);
      for (const o of Object.values(n.options)) signature(o, acc);
    } else if (n.k === "tag") {
      acc.add(`<${n.name}>`);
      const kids = (n as { children: Node[] | null }).children;
      if (kids) signature(kids, acc);
    }
  }
  return acc;
}

export type Values = Record<string, unknown>;
export type Part = string | { tag: string; children: Part[] | null };

const pluralRules = new Map<string, Intl.PluralRules>();
function plural(lang: string, n: number): string {
  let r = pluralRules.get(lang);
  if (!r) {
    try {
      r = new Intl.PluralRules(Intl.PluralRules.supportedLocalesOf([lang]).length ? lang : "en");
    } catch {
      r = new Intl.PluralRules("en");
    }
    pluralRules.set(lang, r);
  }
  return r.select(n);
}

export function render(nodes: Node[], values: Values, lang: string, num: (n: number) => string, hashValue?: number): Part[] {
  const out: Part[] = [];
  const push = (p: Part) => {
    if (typeof p === "string" && typeof out[out.length - 1] === "string") out[out.length - 1] = (out[out.length - 1] as string) + p;
    else out.push(p);
  };
  for (const n of nodes) {
    if (n.k === "text") push(n.v);
    else if (n.k === "hash") push(hashValue === undefined ? "#" : num(hashValue));
    else if (n.k === "arg") {
      const v = values[n.name];
      push(v === undefined || v === null ? "" : String(v)); // numbers as given (years!); format them with format.number()
    } else if (n.k === "plural") {
      const v = Number(values[n.name] ?? 0);
      const opts = n.options;
      const chosen = opts[`=${v}`] ?? opts[plural(lang, v)] ?? opts.other;
      for (const p of render(chosen, values, lang, num, v)) push(p);
    } else if (n.k === "select") {
      const chosen = n.options[String(values[n.name])] ?? n.options.other;
      for (const p of render(chosen, values, lang, num, hashValue)) push(p);
    } else {
      const kids = (n as { children: Node[] | null }).children;
      out.push({ tag: n.name, children: kids ? render(kids, values, lang, num, hashValue) : null });
    }
  }
  return out;
}
