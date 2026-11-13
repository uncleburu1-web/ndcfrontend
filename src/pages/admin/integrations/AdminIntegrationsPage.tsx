/**
 * /admin/integrations — spec 15 §15.3–15.4 (system admins). External services in words, webhook receipts, and
 * background tasks that failed, with Retry (needs reverification). Names and states only: never settings values.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiGet, apiPost, type Schema } from "../../../api/typed";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, useToast } from "../../../components/ui";
import { formatAge, formatDate } from "../../../lib/format";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../../../admin/admin-home.css";
import "./admin-integrations.css";
import { t } from "../../../i18n";

type Service = Schema<"IntegrationService">;
type Job = Schema<"OutboxJob">;

const KIND_WORDS: Record<string, string> = {
  get notify_fanout() { return t("admin.notification-delivery"); }, get media_destroy() { return t("admin.image-clean-up"); }, get media_hide() { return t("admin.hide-a-removed-image"); },
  get media_show() { return t("admin.restore-an-image"); }, get clerk_ban() { return t("admin.block-sign-in-in-clerk"); }, get clerk_unban() { return t("admin.allow-sign-in-in-clerk"); },
  get webhook_retry() { return t("admin.webhook-retry"); }, get email_send() { return t("admin.email"); },
};
const PROVIDER_WORDS: Record<string, string> = { get clerk() { return t("admin.clerk"); }, get paystack() { return t("admin.paystack"); }, get fake() { return t("admin.test-payments"); } };

/** "Paystack: working, last checked 2 min ago" / "Cloudinary: unavailable since 14:05". */
export function serviceWords(s: Service, now = new Date()): { tone: "success" | "warning" | "error" | "info"; text: string } {
  const at = (v: string | null) => (v ? formatDate(v, { withTime: true }) : "");
  switch (s.state) {
    case "ok":
      return { tone: "success", text: s.last_success ? t("admin.working-last-checked-ago", { formatAge: formatAge(s.last_success, now) }) : t("admin.working-not-called-yet") };
    case "failing":
      return { tone: "warning", text: t("admin.the-last-call-failed", { v: s.last_failure ? t("admin.at", { at: at(s.last_failure) }) : "", v2: s.last_reason ? ` (${s.last_reason})` : "" }) };
    case "unavailable":
      return { tone: "error", text: t("admin.unavailable-since-ndcconnect-is-waiting-before", { at: at(s.last_failure) }) };
    case "not_configured":
      return { tone: "error", text: t("admin.not-set-up-its-settings-are") };
    default:
      return { tone: "info", text: t("admin.not-in-use-here") };
  }
}

function Services({ services }: { services: Service[] }) {
  return (
    <ul className="adm-int__services">
      {services.map((s) => {
        const w = serviceWords(s);
        return (
          <li key={s.key} className={`adm-int__service adm-int__service--${w.tone}`}>
            <p className="adm-int__service-line"><strong>{s.name}</strong>: {w.text}</p>
            <p className="adm-muted">{t("admin.sends-timeouts", { purpose: s.purpose, data_sent: s.data_sent, timeouts: s.timeouts })}</p>
            <details>
              <summary>{t("admin.settings-it-needs")}</summary>
              <p className="adm-muted">{s.settings.join(", ")}</p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function Webhooks() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const provider = params.get("provider") ?? "";
  const status = params.get("wstatus") ?? "";
  const page = Math.max(1, Number(params.get("wpage") ?? 1) || 1);
  const qs = new URLSearchParams();
  if (provider) qs.set("provider", provider);
  if (status) qs.set("status", status);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`int-webhooks:${qs}`, (signal) =>
    api<Schema<"WebhookReceiptPage">>(`/admin/integrations/webhooks/${qs.toString() ? `?${qs}` : ""}`, { signal }));
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    n.delete("wpage");
    setParams(n);
  };
  return (
    <section className="adm-panel" aria-labelledby="int-wh">
      <h2 id="int-wh">{t("admin.webhooks-received")}</h2>
      <p className="ds-field__hint">{t("admin.one-line-per-event-from-clerk")}</p>
      <div className="adm-int__filters">
        <Select label={t("admin.from-2")} value={provider} onChange={(e) => set("provider", e.target.value)}
          options={[{ value: "", label: t("admin.any-service") }, { value: "clerk", label: t("admin.clerk") }, { value: "paystack", label: t("admin.paystack") }, { value: "fake", label: t("admin.test-payments") }]} />
        <Select label={t("admin.result")} value={status} onChange={(e) => set("wstatus", e.target.value)}
          options={[{ value: "", label: t("admin.any-result") }, { value: "processed", label: t("admin.processed") }, { value: "ignored", label: t("admin.ignored") }, { value: "failed", label: t("admin.failed") }]} />
      </div>
      {res.error ? <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
        : !res.data ? <Skeleton width="100%" height={120} />
        : res.data.count === 0 ? <EmptyState title={t("admin.no-webhooks-match")} />
        : (
          <>
            <ul className="adm-int__list">
              {res.data.results.map((r) => (
                <li key={r.id}>
                  <span><strong>{PROVIDER_WORDS[r.provider] ?? r.provider}</strong> · {r.event_type || t("admin.event-2")}</span>
                  <span className={`adm-int__result adm-int__result--${r.status}`}>
                    {r.status === "processed" ? t("admin.processed") : r.status === "ignored" ? t("admin.ignored") : t("admin.failed")}
                    {!r.signature_valid && t("admin.signature-didn-t-verify")}
                    {r.attempts > 1 && t("admin.tries", { attempts: r.attempts })}
                  </span>
                  <span className="adm-muted">{formatDate(r.received_at, { withTime: true })}{r.error && ` · ${r.error}`}</span>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageCount={Math.max(1, Math.ceil(res.data.count / 20))}
              onChange={(p) => { const n = new URLSearchParams(params); n.set("wpage", String(p)); setParams(n); }} />
          </>
        )}
    </section>
  );
}

function Tasks({ onChanged }: { onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [status, setStatus] = useState<"failed" | "stuck" | "pending" | "done">("failed");
  const [busy, setBusy] = useState<string | null>(null);
  const res = useRequest(`int-outbox:${status}`, (signal) =>
    api<Schema<"OutboxJobPage">>(`/admin/integrations/outbox/?status=${status}`, { signal }));
  const retry = async (j: Job) => {
    setBusy(j.id);
    try {
      await apiPost(api, "/admin/integrations/outbox/{id}/retry/", undefined, { id: j.id });
      toast.show({ tone: "success", message: t("admin.queued-to-run-again", { v: KIND_WORDS[j.kind] ?? j.kind }) });
      res.retry();
      onChanged();
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError({});
      if (e.code !== "reverification_cancelled") toast.show({ tone: "error", message: e.message });
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="adm-panel" aria-labelledby="int-jobs">
      <h2 id="int-jobs">{t("admin.background-tasks")}</h2>
      <p className="ds-field__hint">{t("admin.work-that-runs-after-a-change")}</p>
      <div className="adm-int__filters">
        <Select label={t("admin.show")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[{ value: "failed", label: t("admin.failed") }, { value: "stuck", label: t("admin.waiting-too-long") }, { value: "pending", label: t("admin.waiting-2") }, { value: "done", label: t("admin.done") }]} />
      </div>
      {res.error ? <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
        : !res.data ? <Skeleton width="100%" height={120} />
        : res.data.count === 0 ? <EmptyState title={status === "failed" ? t("admin.no-failed-tasks") : t("admin.nothing-here")}>{status === "failed" ? t("admin.everything-that-ran-has-finished") : ""}</EmptyState>
        : (
          <ul className="adm-int__list">
            {res.data.results.map((j) => (
              <li key={j.id}>
                <span><strong>{KIND_WORDS[j.kind] ?? j.kind}</strong> · {j.status === "failed" ? t("admin.failed-2") : j.stuck ? t("admin.waiting-too-long-2") : j.status}
                  {t("admin.of-tries", { attempts: j.attempts, max_attempts: j.max_attempts })}</span>
                <span className="adm-muted">
                  {j.status === "failed" && j.finished_at ? t("admin.gave-up", { formatDate: formatDate(j.finished_at, { withTime: true }) }) : t("admin.next-try", { formatDate: formatDate(j.next_attempt_at, { withTime: true }) })}
                  {j.last_error && ` · ${j.last_error}`}
                  {j.request_id && t("admin.reference-2", { slice: j.request_id.slice(0, 8) })}
                </span>
                {(j.status === "failed" || j.status === "pending") && (
                  <span><Button size="sm" variant="secondary" loading={busy === j.id} loadingLabel={t("admin.retrying")} onClick={() => void retry(j)}>{t("admin.retry")}</Button></span>
                )}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

export default function AdminIntegrationsPage() {
  const api = useApi();
  const res = useRequest("admin-integrations", (signal) => apiGet(api, "/admin/integrations/", undefined, { signal }));
  useEffect(() => {
    document.title = t("admin.integrations-ndcconnect-admin");
  }, []);
  const o = res.data?.outbox;
  return (
    <div className="adm-page">
      <AdminNav current="integrations" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.integrations")}</h1>
          <p className="ds-field__hint">{t("admin.the-outside-services-ndcconnect-relies-on")}</p>
        </div>
      </header>
      {res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <>
          {o && (o.failed > 0 || o.stuck) && (
            <Banner tone={o.stuck ? "error" : "warning"} title={o.stuck ? t("admin.background-tasks-are-waiting-too-long") : t("admin.some-background-tasks-failed")}>
              {o.stuck ? t("admin.the-oldest-has-waited-minutes-check", { round: Math.round(o.oldest_due_age_s / 60) }) : t("admin.failed-after-every-retry-retry-them", { failed: o.failed })}
            </Banner>
          )}
          <section className="adm-panel" aria-labelledby="int-svc">
            <h2 id="int-svc">{t("admin.services")}</h2>
            <Services services={res.data.services} />
            <p className="adm-muted">{t("admin.updated-background-other-waiting", { formatDate: formatDate(res.data.generated_at, { withTime: true }), v: o?.pending ?? 0, pending: o?.pending })}</p>
          </section>
          {res.data.webhooks.length > 0 && (
            <section className="adm-panel" aria-labelledby="int-24">
              <h2 id="int-24">{t("admin.last-24-hours")}</h2>
              <ul className="adm-int__list">
                {res.data.webhooks.map((w) => (
                  <li key={w.provider}>
                    <span><strong>{PROVIDER_WORDS[w.provider] ?? w.provider}</strong></span>
                    <span>{t("admin.processed-ignored-failed", { processed: w.processed, ignored: w.ignored, failed: w.failed, v: w.bad_signatures ? t("admin.with-a-bad-signature", { bad_signatures: w.bad_signatures }) : "" })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <Tasks onChanged={res.retry} />
      <Webhooks />
    </div>
  );
}
