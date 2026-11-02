/** Wraps matched ranges in <mark> (spec 12 §3.5, §8.1). Text stays text: no HTML from the server is ever inserted. */
import type { Range } from "./types";

export function Highlight({ text, ranges }: { text: string; ranges?: Range[] }) {
  if (!ranges || ranges.length === 0) return <>{text}</>;
  const parts: (string | JSX.Element)[] = [];
  let at = 0;
  ranges
    .filter(([s, e]) => s >= 0 && e > s && s < text.length)
    .sort((a, b) => a[0] - b[0])
    .forEach(([s, e], i) => {
      if (s < at) return;
      if (s > at) parts.push(text.slice(at, s));
      parts.push(<mark key={i} className="search-mark">{text.slice(s, Math.min(e, text.length))}</mark>);
      at = Math.min(e, text.length);
    });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
