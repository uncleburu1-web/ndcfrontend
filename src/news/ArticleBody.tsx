/**
 * Plain-text article body — spec 07 §3.8. Paragraphs split on blank lines; https:// URLs become links.
 * Everything is rendered as React text: never dangerouslySetInnerHTML.
 */
import { Fragment } from "react";

const URL_RE = /(https:\/\/[^\s<>"']+)/g;
const TRAILING = /[.,;:!?)\]]+$/;

function Linked({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const trail = part.match(TRAILING)?.[0] ?? "";
        const href = trail ? part.slice(0, -trail.length) : part;
        return (
          <Fragment key={i}>
            <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{href}</a>
            {trail}
          </Fragment>
        );
      })}
    </>
  );
}

export function ArticleBody({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="article-body">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              <Linked text={line} />
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
