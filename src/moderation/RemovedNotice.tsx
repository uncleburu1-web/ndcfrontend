/** "Removed by NDCConnect" — the public notice on a removed article or post (spec 13 §4.5). No content is shown. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { Icon } from "../components/ui";
import type { RemovalNotice } from "./types";
import "./moderation.css";
import { t } from "../i18n";

export function removalFromError(err: unknown): RemovalNotice | null {
  if (!(err instanceof ApiError) || err.status !== 410 || err.code !== "removed") return null;
  const x = err.extra as Partial<RemovalNotice>;
  return { removed: true, rule: x.rule ?? "", rule_title: x.rule_title ?? "", kind: x.kind ?? "item", source: x.source ?? "rules" };
}

export function RemovedNotice({ notice, back }: { notice: RemovalNotice; back?: { href: string; label: string } }) {
  const what = notice.kind === "official announcement" ? "announcement" : notice.kind;
  let text: ReactNode;
  if (notice.source === "copyright") text = <>{t("moderation.this-was-removed-after-a-copyright", { what })}</>;
  else if (notice.source === "legal") text = <>{t("moderation.this-was-removed-after-a-legal", { what })}</>;
  else if (notice.rule) {
    text = (
      <>{t.rich("moderation.this-broke-rule", { what, rule: notice.rule, rule_title: notice.rule_title, link: (chunks) => <Link to={`/rules#${notice.rule}`}>{chunks}</Link> })}</>
    );
  } else text = <>{t("moderation.this-broke-our-community-rules", { what })}</>;
  return (
    <div className="page-shell">
      <section className="mod-removed" aria-labelledby="removed-h">
        <Icon name="shield" size={28} />
        <div>
          <h1 id="removed-h">{t("moderation.removed-by-ndcconnect")}</h1>
          <p>{text}</p>
          <p><Link to="/rules">{t("moderation.see-our-community-rules")}</Link>{back && <> · <Link to={back.href}>{back.label}</Link></>}</p>
        </div>
      </section>
    </div>
  );
}
