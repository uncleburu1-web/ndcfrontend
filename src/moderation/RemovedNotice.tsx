/** "Removed by NDCConnect" — the public notice on a removed article or post (spec 13 §4.5). No content is shown. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { Icon } from "../components/ui";
import type { RemovalNotice } from "./types";
import "./moderation.css";

export function removalFromError(err: unknown): RemovalNotice | null {
  if (!(err instanceof ApiError) || err.status !== 410 || err.code !== "removed") return null;
  const x = err.extra as Partial<RemovalNotice>;
  return { removed: true, rule: x.rule ?? "", rule_title: x.rule_title ?? "", kind: x.kind ?? "item", source: x.source ?? "rules" };
}

export function RemovedNotice({ notice, back }: { notice: RemovalNotice; back?: { href: string; label: string } }) {
  const what = notice.kind === "official announcement" ? "announcement" : notice.kind;
  let text: ReactNode;
  if (notice.source === "copyright") text = <>This {what} was removed after a copyright notice.</>;
  else if (notice.source === "legal") text = <>This {what} was removed after a legal notice.</>;
  else if (notice.rule) {
    text = (
      <>This {what} broke rule <Link to={`/rules#${notice.rule}`}>{notice.rule}: {notice.rule_title}</Link>.</>
    );
  } else text = <>This {what} broke our community rules.</>;
  return (
    <div className="page-shell">
      <section className="mod-removed" aria-labelledby="removed-h">
        <Icon name="shield" size={28} />
        <div>
          <h1 id="removed-h">Removed by NDCConnect</h1>
          <p>{text}</p>
          <p><Link to="/rules">See our community rules</Link>{back && <> · <Link to={back.href}>{back.label}</Link></>}</p>
        </div>
      </section>
    </div>
  );
}
