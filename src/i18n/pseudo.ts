/**
 * Spec 21 §5.7: the pseudo-language `qps` — every letter accented and the text about 40% longer, inside [ ].
 * Placeholders, plural/select syntax and tags are left alone, so the message still works. Development and the live
 * check only; never selectable in production.
 */
const ACCENTS: Record<string, string> = {
  a: "à", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ö",
  p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ö",
  P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

export function pseudo(msg: string): string {
  let out = "";
  let depth = 0; // inside {…} syntax, only option bodies (after a second {) are text
  let inTag = false;
  let letters = 0;
  for (let i = 0; i < msg.length; i++) {
    const c = msg[i];
    if (c === "<") inTag = true;
    if (inTag) {
      out += c;
      if (c === ">") inTag = false;
      continue;
    }
    if (c === "{") {
      depth += 1;
      out += c;
      continue;
    }
    if (c === "}") {
      depth -= 1;
      out += c;
      continue;
    }
    // Text at depth 0, or inside a plural/select option (depth 2, 4…), is translatable.
    if (depth % 2 === 0 && ACCENTS[c]) {
      out += ACCENTS[c];
      letters += 1;
    } else out += c;
  }
  return `[${out}${" ~".repeat(Math.max(1, Math.round(letters * 0.2)))}]`;
}
