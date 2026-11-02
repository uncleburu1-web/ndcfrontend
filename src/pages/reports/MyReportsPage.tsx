/** /reports — the signed-in member's reports and their status (spec 13 §4.2). Never shows who decided. */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, StatusBadge } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { MyReport } from "../../moderation/types";
import "../../moderation/moderation.css";

const KIND: Record<string, string> = { article: "News", post: "Candidate post", candidate: "Candidate profile" };

export default function MyReportsPage() {
  const api = useApi();
  const res = useRequest("my-reports", (signal) => api<{ results: MyReport[] }>("/me/reports/", { signal }));
  useEffect(() => {
    document.title = "My reports | NDCConnect";
  }, []);
  return (
    <div className="mod-page">
      <h1>My reports</h1>
      <p className="mod-lead">What you’ve reported and what happened. Authors never see who reported them.</p>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load your reports" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data.results.length === 0 ? (
        <EmptyState title="You haven’t reported anything">Use Report on any news story, post or candidate profile that breaks our <Link to="/rules">rules</Link>.</EmptyState>
      ) : (
        <ul className="mod-list">
          {res.data.results.map((r) => (
            <li key={r.reference} className="mod-list__item">
              <StatusBadge set="report" status={r.status} />
              <h3>{r.title || `A ${KIND[r.target_kind].toLowerCase()} we removed`}</h3>
              <p className="mod-meta">{KIND[r.target_kind]} · {r.reason_label} · reported {formatDate(r.created_at)} · {r.reference}</p>
              <p className="mod-meta">Status: {r.status_label}{r.resolved_at ? ` (${formatDate(r.resolved_at)})` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
