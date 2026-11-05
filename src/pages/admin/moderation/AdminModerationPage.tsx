/** /admin/moderation — one queue for every report, ordered by urgency then age (spec 13 §4.3). */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Checkbox, EmptyState, Icon, Pagination, Select, Skeleton, StatusBadge } from "../../../components/ui";
import { formatAge } from "../../../lib/format";
import { STATES } from "../../../lib/nigeria";
import { useAutoRefresh } from "../../../admin/useAutoRefresh";
import { AppealsList } from "../../../moderation/AppealsList";
import { REPORT_REASONS } from "../../../news/types";
import type { CaseRow } from "../../../moderation/types";
import { dueWords } from "../../../moderation/words";
import { AdminNav } from "../AdminNav";
import { ModerationNav } from "./ModerationNav";
import "../candidates/admin.css";
import "../../../moderation/moderation.css";

interface Page { count: number; results: CaseRow[]; counts: Record<string, number>; is_system_admin: boolean }
const FILTERS = ["type", "reason", "priority", "overdue", "state"] as const;

export function CaseTable({ rows, closed }: { rows: CaseRow[]; closed?: boolean }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr><th>Priority</th><th>Item</th><th>Reports</th><th>{closed ? "Outcome" : "Age and time left"}</th><th>Assigned</th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <StatusBadge set="priority" status={c.priority} />
                {c.legal_due_at && c.priority !== "legal" && <><br /><span className="mod-meta">Legal: 48 h</span></>}
              </td>
              <td>
                <span className="mod-meta">{c.kind_label}{c.status === "escalated" ? " · Escalated" : ""}</span><br />
                <Link to={`/admin/moderation/${c.id}`}>{c.title || "(untitled)"}</Link>
                {c.burst_flag && <><br /><span className="mod-flag"><Icon name="alert" size={14} /> Burst of reports: look carefully</span></>}
                {c.legal_hold && <><br /><span className="mod-meta">Legal hold</span></>}
              </td>
              <td>{c.report_count}{c.top_reason ? <><br /><span className="mod-meta">{c.top_reason.label}</span></> : null}</td>
              <td>
                {closed ? (
                  <StatusBadge set="case" status={c.decision || "closed"} />
                ) : (
                  <>
                    <span className="mod-meta">{formatAge(c.opened_at)} old</span><br />
                    <span className={`mod-due${c.due?.overdue ? " mod-due--overdue" : ""}`}>{dueWords(c.due)}</span>
                  </>
                )}
              </td>
              <td>{c.assigned_to ? (c.assigned_to.me ? "You" : c.assigned_to.email) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminModerationPage({ forcedTab }: { forcedTab?: "appeals" }) {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const tab = forcedTab ?? params.get("tab") ?? "open";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const qs = new URLSearchParams({ tab });
  for (const f of FILTERS) if (params.get(f)) qs.set(f, params.get(f)!);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`moderation:${qs}`, (signal) => api<Page>(`/admin/moderation/cases/?${qs}`, { signal }));
  useAutoRefresh(res.retry, 60_000);
  useEffect(() => {
    document.title = "Moderation | NDCConnect admin";
  }, []);

  const setFilter = (k: string, v: string) => {
    const q = new URLSearchParams(params);
    if (v) q.set(k, v);
    else q.delete(k);
    q.delete("page");
    setParams(q);
  };

  return (
    <div className="adm-page">
      <AdminNav current="moderation" />
      <header className="adm-page__head">
        <div>
          <h1>Moderation</h1>
          <p className="ds-field__hint">
            Every report, in one queue. Decide against the <Link to="/rules">community rules</Link>: urgent within 24 hours, high 2 days, normal 3 days,
            low 7 days. Report counts never decide anything.
          </p>
        </div>
      </header>
      <ModerationNav current={tab} counts={res.data?.counts} />
      {tab === "appeals" ? (
        <AppealsList />
      ) : (
        <>
          <div className="mod-filters">
            <Select label="Type" value={params.get("type") ?? ""} onChange={(e) => setFilter("type", e.target.value)} options={[
              { value: "", label: "All types" }, { value: "news", label: "News" }, { value: "posts", label: "Candidate posts" },
              { value: "communities", label: "Communities" }, { value: "events", label: "Events" },
              ...(res.data?.is_system_admin ? [{ value: "profiles", label: "Candidate profiles" }] : []),
            ]} />
            <Select label="Reason" value={params.get("reason") ?? ""} onChange={(e) => setFilter("reason", e.target.value)}
              options={[{ value: "", label: "Any reason" }, ...REPORT_REASONS.filter(([v]) => v !== "copyright").map(([value, label]) => ({ value, label }))]} />
            <Select label="Priority" value={params.get("priority") ?? ""} onChange={(e) => setFilter("priority", e.target.value)} options={[
              { value: "", label: "Any priority" }, { value: "urgent", label: "Urgent and legal" }, { value: "high", label: "High" },
              { value: "normal", label: "Normal" }, { value: "low", label: "Low" },
            ]} />
            <Select label="State" value={params.get("state") ?? ""} onChange={(e) => setFilter("state", e.target.value)}
              options={[{ value: "", label: "All states" }, ...STATES]} />
            <Checkbox label="Overdue only" checked={params.get("overdue") === "1"} onChange={(e) => setFilter("overdue", e.target.checked ? "1" : "")} />
          </div>
          {res.error ? (
            <Banner tone="error" title="We couldn’t load the queue" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
          ) : res.loading && !res.data ? (
            <Skeleton width="100%" height={200} />
          ) : res.data && res.data.count === 0 ? (
            <EmptyState title={tab === "closed" ? "No closed cases" : tab === "mine" ? "Nothing assigned to you" : "Nothing to review"} />
          ) : res.data ? (
            <>
              <CaseTable rows={res.data.results} closed={tab === "closed"} />
              <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label="Case pages"
                onChange={(n) => { const q = new URLSearchParams(params); if (n > 1) q.set("page", String(n)); else q.delete("page"); setParams(q); }} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
