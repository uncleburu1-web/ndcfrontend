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
import { t } from "../../../i18n";
import { languageName } from "../../../i18n/ContentLanguage";
import { StaffLanguages } from "../languages/StaffLanguages";

interface Page { count: number; results: CaseRow[]; counts: Record<string, number>; is_system_admin: boolean }
const FILTERS = ["type", "reason", "priority", "overdue", "state", "language"] as const;

export function CaseTable({ rows, closed }: { rows: CaseRow[]; closed?: boolean }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr><th>{t("admin.priority-3")}</th><th>{t("admin.item-2")}</th><th>{t("admin.reports-2")}</th><th>{closed ? t("admin.outcome") : t("admin.age-and-time-left")}</th><th>{t("admin.assigned")}</th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <StatusBadge set="priority" status={c.priority} />
                {c.legal_due_at && c.priority !== "legal" && <><br /><span className="mod-meta">{t("admin.legal-48-h")}</span></>}
              </td>
              <td>
                <span className="mod-meta">{c.kind_label}{c.status === "escalated" ? t("admin.escalated") : ""}{(c as { language?: string }).language && (c as { language?: string }).language !== "und" ? ` · ${languageName((c as { language?: string }).language!)}` : ""}</span><br />
                <Link to={`/admin/moderation/${c.id}`}>{c.title || t("admin.untitled")}</Link>
                {c.burst_flag && <><br /><span className="mod-flag">{t.rich("admin.burst-of-reports-look-carefully", { icon: <Icon name="alert" size={14} /> })}</span></>}
                {c.legal_hold && <><br /><span className="mod-meta">{t("admin.legal-hold")}</span></>}
              </td>
              <td>{c.report_count}{c.top_reason ? <><br /><span className="mod-meta">{c.top_reason.label}</span></> : null}</td>
              <td>
                {closed ? (
                  <StatusBadge set="case" status={c.decision || "closed"} />
                ) : (
                  <>
                    <span className="mod-meta">{t("admin.old", { formatAge: formatAge(c.opened_at) })}</span><br />
                    <span className={`mod-due${c.due?.overdue ? " mod-due--overdue" : ""}`}>{dueWords(c.due)}</span>
                  </>
                )}
              </td>
              <td>{c.assigned_to ? (c.assigned_to.me ? t("admin.you") : c.assigned_to.email) : "—"}</td>
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
    document.title = t("admin.moderation-ndcconnect-admin");
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
          <h1>{t("admin.moderation")}</h1>
          <p className="ds-field__hint">
            {t.rich("admin.every-report-in-one-queue-decide", { link: (chunks) => <Link to="/rules">{chunks}</Link> })}</p>
        </div>
      </header>
      <ModerationNav current={tab} counts={res.data?.counts} />
      {tab === "appeals" ? (
        <AppealsList />
      ) : (
        <>
          <StaffLanguages />
          <div className="mod-filters">
            <Select label={t("admin.type")} value={params.get("type") ?? ""} onChange={(e) => setFilter("type", e.target.value)} options={[
              { value: "", label: t("admin.all-types") }, { value: "news", label: t("admin.news") }, { value: "posts", label: t("admin.candidate-posts") },
              { value: "communities", label: t("admin.communities") }, { value: "events", label: t("admin.events") }, { value: "people", label: t("admin.public-profiles") },
              ...(res.data?.is_system_admin ? [{ value: "profiles", label: t("admin.candidate-profiles") }] : []),
            ]} />
            <Select label={t("admin.language")} value={params.get("language") ?? ""} onChange={(e) => setFilter("language", e.target.value)}
              options={[{ value: "", label: t("content.all-languages") }, { value: "mine", label: t("admin.languages-i-read") },
                ...(["en", "ha", "ig", "yo", "pcm", "und"] as const).map((c) => ({ value: c, label: languageName(c) }))]} />
            <Select label={t("admin.reason")} value={params.get("reason") ?? ""} onChange={(e) => setFilter("reason", e.target.value)}
              options={[{ value: "", label: t("admin.any-reason") }, ...REPORT_REASONS.filter(([v]) => v !== "copyright").map(([value, label]) => ({ value, label }))]} />
            <Select label={t("admin.priority-3")} value={params.get("priority") ?? ""} onChange={(e) => setFilter("priority", e.target.value)} options={[
              { value: "", label: t("admin.any-priority") }, { value: "urgent", label: t("admin.urgent-and-legal") }, { value: "high", label: t("admin.high") },
              { value: "normal", label: t("admin.normal") }, { value: "low", label: t("admin.low") },
            ]} />
            <Select label={t("admin.state")} value={params.get("state") ?? ""} onChange={(e) => setFilter("state", e.target.value)}
              options={[{ value: "", label: t("admin.all-states") }, ...STATES]} />
            <Checkbox label={t("admin.overdue-only")} checked={params.get("overdue") === "1"} onChange={(e) => setFilter("overdue", e.target.checked ? "1" : "")} />
          </div>
          {res.error ? (
            <Banner tone="error" title={t("admin.we-couldn-t-load-the-queue")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
          ) : res.loading && !res.data ? (
            <Skeleton width="100%" height={200} />
          ) : res.data && res.data.count === 0 ? (
            <EmptyState title={tab === "closed" ? t("admin.no-closed-cases") : tab === "mine" ? t("admin.nothing-assigned-to-you") : t("admin.nothing-to-review-2")} />
          ) : res.data ? (
            <>
              <CaseTable rows={res.data.results} closed={tab === "closed"} />
              <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label={t("admin.case-pages")}
                onChange={(n) => { const q = new URLSearchParams(params); if (n > 1) q.set("page", String(n)); else q.delete("page"); setParams(q); }} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
