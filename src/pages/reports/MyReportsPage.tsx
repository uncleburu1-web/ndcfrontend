/** /reports — the signed-in member's reports and their status (spec 13 §4.2). Never shows who decided. */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, StatusBadge } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { MyReport } from "../../moderation/types";
import "../../moderation/moderation.css";
import { t } from "../../i18n";

const KIND: Record<string, string> = { article: "News", post: "Candidate post", candidate: "Candidate profile" };

export default function MyReportsPage() {
  const api = useApi();
  const res = useRequest("my-reports", (signal) => api<{ results: MyReport[] }>("/me/reports/", { signal }));
  useEffect(() => {
    document.title = t("reports.my-reports-ndcconnect");
  }, []);
  return (
    <div className="mod-page">
      <h1>{t("reports.my-reports")}</h1>
      <p className="mod-lead">{t("reports.what-you-ve-reported-and-what")}</p>
      {res.error ? (
        <Banner tone="error" title={t("reports.we-couldn-t-load-your-reports")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("reports.try-again")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data.results.length === 0 ? (
        <EmptyState title={t("reports.you-haven-t-reported-anything")}>{t.rich("reports.use-report-on-any-news-story", { link: (chunks) => <Link to="/rules">{chunks}</Link> })}</EmptyState>
      ) : (
        <ul className="mod-list">
          {res.data.results.map((r) => (
            <li key={r.reference} className="mod-list__item">
              <StatusBadge set="report" status={r.status} />
              <h3>{r.title || t("reports.a-we-removed", { toLowerCase: KIND[r.target_kind].toLowerCase() })}</h3>
              <p className="mod-meta">{t("reports.reported", { KIND: KIND[r.target_kind], reason_label: r.reason_label, formatDate: formatDate(r.created_at), reference: r.reference })}</p>
              <p className="mod-meta">{t("reports.status", { status_label: r.status_label, v: r.resolved_at ? ` (${formatDate(r.resolved_at)})` : "" })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
