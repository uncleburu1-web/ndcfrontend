/**
 * /admin — the Admin home (spec 11 §4.2). The backend sends only the sections the caller's roles allow;
 * this page renders what it gets. Refreshes every 60 s while visible and never blanks while refreshing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { Banner, Button, EmptyState, Skeleton } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ActivityRow, AttentionCard, JobsList, ReadinessList, StatTile } from "../../../admin/AdminParts";
import type { Blackout, Overview } from "../../../admin/types";
import { useAutoRefresh } from "../../../admin/useAutoRefresh";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../../../admin/admin-home.css";
import { t } from "../../../i18n";

const offices = (b: Blackout) => b.offices.join(", ");

export default function AdminHomePage() {
  const api = useApi();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    api<Overview>("/admin/overview/")
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError({})))
      .finally(() => { inFlight.current = false; setRefreshing(false); });
  }, [api]);
  useEffect(() => load(), [load]);
  useAutoRefresh(load);
  useEffect(() => {
    document.title = t("admin.admin-ndcconnect");
  }, []);

  if (!data) {
    return (
      <div className="adm-page">
        <AdminNav current="overview" />
        {error ? (
          <Banner tone="error" title={t("admin.we-couldn-t-load-the-admin")} action={<Button size="sm" variant="secondary" onClick={load}>{t("admin.try-again-2")}</Button>}>
            {error.message}
          </Banner>
        ) : <Skeleton width="100%" height={240} />}
      </div>
    );
  }

  const failedJob = data.jobs?.find((j) => j.state === "failed");
  const allClear = data.attention.every((c) => c.count === 0);
  return (
    <div className="adm-page">
      <AdminNav current="overview" />
      <header className="adm-home__head">
        <div>
          <h1>{t("admin.admin")}</h1>
          <p className="adm-muted">{data.roles.map((r) => r.label).join(" · ")}</p>
        </div>
        <div className="adm-home__updated">
          <span aria-live="polite">{refreshing ? t("admin.refreshing") : t("admin.updated-4", { pop: formatDate(data.generated_at, { withTime: true }).split(", ").pop() })}</span>
          <Button size="sm" variant="secondary" onClick={load} disabled={refreshing}>{t("admin.refresh")}</Button>
        </div>
      </header>

      <div className="adm-home__banners">
        {error && <Banner tone="warning">{t("admin.couldn-t-refresh-just-now-showing")}</Banner>}
        {data.blackouts.active.map((b) => (
          <Banner key={b.end + offices(b)} tone="warning" title={t("admin.campaign-blackout")}>
            {t("admin.campaign-blackout-for-until-announcements-approvals", { offices: offices(b), formatDate: formatDate(b.end, { withTime: true }) })}</Banner>
        ))}
        {data.blackouts.next && (
          <Banner tone="info">
            {t("admin.next-campaign-blackout-from", { offices: offices(data.blackouts.next), formatDate: formatDate(data.blackouts.next.start, { withTime: true }) })}</Banner>
        )}
        {failedJob && (
          <Banner tone="error" title={t("admin.a-background-job-failed")}>
            {t.rich("admin.failed-in-its-last-run-see", { label: failedJob.label, a: (chunks) => <a href="#jobs-title">{chunks}</a> })}</Banner>
        )}
        {data.failed.map((f) => (
          <Banner key={f.app} tone="error" action={<Button size="sm" variant="secondary" onClick={load}>{t("admin.try-again-2")}</Button>}>
            {t("admin.couldn-t-load", { label: f.label })}</Banner>
        ))}
      </div>

      <div className="adm-home__grid">
        <div className="adm-home__col">
          <section className="adm-panel" aria-labelledby="attn-title">
            <h2 id="attn-title">{t("admin.needs-your-attention")}</h2>
            {data.attention.length === 0 || allClear ? (
              <EmptyState icon="checkCircle" title={t("admin.nothing-waiting")}>{t("admin.you-re-all-caught-up")}</EmptyState>
            ) : null}
            {data.attention.length > 0 && !allClear && (
              <ul className="adm-attn-list">
                {data.attention.map((c) => <AttentionCard key={c.key} card={c} />)}
              </ul>
            )}
          </section>
          {data.activity && (
            <section className="adm-panel" aria-labelledby="activity-title">
              <h2 id="activity-title">{t("admin.recent-activity")}</h2>
              {data.activity.length ? (
                <ul className="adm-activity">{data.activity.map((e) => <ActivityRow key={e.id} e={e} />)}</ul>
              ) : <p className="adm-muted">{t("admin.nothing-yet")}</p>}
              <p><Link to="/admin/audit">{t("admin.see-the-full-audit-log")}</Link></p>
            </section>
          )}
        </div>
        <div className="adm-home__col">
          {data.stats.length > 0 && (
            <section className="adm-panel" aria-labelledby="glance-title">
              <h2 id="glance-title">{t("admin.at-a-glance")}</h2>
              {data.stats.map((g) => (
                <div key={g.group} className="adm-stat-group">
                  <h3>{g.label}</h3>
                  <ul className="adm-stat-list">{g.stats.map((s) => <StatTile key={s.key} stat={s} />)}</ul>
                </div>
              ))}
            </section>
          )}
          {data.readiness && (
            <section className="adm-panel" aria-labelledby="ready-title">
              <h2 id="ready-title">{t("admin.readiness")}</h2>
              <ReadinessList items={data.readiness.items} />
              {data.readiness.blackouts.length > 0 && (
                <>
                  <h3 className="adm-subhead">{t("admin.blackout-windows")}</h3>
                  <ul className="adm-activity">
                    {data.readiness.blackouts.map((b) => (
                      <li key={b.start + offices(b)} className="adm-activity__item">
                        <span><strong>{offices(b)}</strong> · {{ active: "Active", upcoming: "Upcoming", past: "Past" }[b.state]}</span>
                        <span className="adm-muted">{formatDate(b.start, { withTime: true })} – {formatDate(b.end, { withTime: true })}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {data.jobs && (
            <section className="adm-panel" aria-labelledby="jobs-title">
              <h2 id="jobs-title">{t("admin.background-jobs")}</h2>
              <JobsList jobs={data.jobs} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
