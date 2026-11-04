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

type Service = Schema<"IntegrationService">;
type Job = Schema<"OutboxJob">;

const KIND_WORDS: Record<string, string> = {
  notify_fanout: "Notification delivery", media_destroy: "Image clean-up", media_hide: "Hide a removed image",
  media_show: "Restore an image", clerk_ban: "Block sign-in in Clerk", clerk_unban: "Allow sign-in in Clerk",
  webhook_retry: "Webhook retry", email_send: "Email",
};
const PROVIDER_WORDS: Record<string, string> = { clerk: "Clerk", paystack: "Paystack", fake: "Test payments" };

/** "Paystack: working, last checked 2 min ago" / "Cloudinary: unavailable since 14:05". */
export function serviceWords(s: Service, now = new Date()): { tone: "success" | "warning" | "error" | "info"; text: string } {
  const at = (v: string | null) => (v ? formatDate(v, { withTime: true }) : "");
  switch (s.state) {
    case "ok":
      return { tone: "success", text: s.last_success ? `working, last checked ${formatAge(s.last_success, now)} ago` : "working (not called yet)" };
    case "failing":
      return { tone: "warning", text: `the last call failed${s.last_failure ? ` at ${at(s.last_failure)}` : ""}${s.last_reason ? ` (${s.last_reason})` : ""}` };
    case "unavailable":
      return { tone: "error", text: `unavailable since ${at(s.last_failure)}; NDCConnect is waiting before trying again` };
    case "not_configured":
      return { tone: "error", text: "not set up: its settings are missing" };
    default:
      return { tone: "info", text: "not in use here" };
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
            <p className="adm-muted">{s.purpose}. Sends: {s.data_sent}. Timeouts: {s.timeouts}.</p>
            <details>
              <summary>Settings it needs</summary>
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
      <h2 id="int-wh">Webhooks received</h2>
      <p className="ds-field__hint">One line per event from Clerk or Paystack. Payloads are never stored, only a fingerprint.</p>
      <div className="adm-int__filters">
        <Select label="From" value={provider} onChange={(e) => set("provider", e.target.value)}
          options={[{ value: "", label: "Any service" }, { value: "clerk", label: "Clerk" }, { value: "paystack", label: "Paystack" }, { value: "fake", label: "Test payments" }]} />
        <Select label="Result" value={status} onChange={(e) => set("wstatus", e.target.value)}
          options={[{ value: "", label: "Any result" }, { value: "processed", label: "Processed" }, { value: "ignored", label: "Ignored" }, { value: "failed", label: "Failed" }]} />
      </div>
      {res.error ? <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
        : !res.data ? <Skeleton width="100%" height={120} />
        : res.data.count === 0 ? <EmptyState title="No webhooks match" />
        : (
          <>
            <ul className="adm-int__list">
              {res.data.results.map((r) => (
                <li key={r.id}>
                  <span><strong>{PROVIDER_WORDS[r.provider] ?? r.provider}</strong> · {r.event_type || "event"}</span>
                  <span className={`adm-int__result adm-int__result--${r.status}`}>
                    {r.status === "processed" ? "Processed" : r.status === "ignored" ? "Ignored" : "Failed"}
                    {!r.signature_valid && " · signature didn’t verify"}
                    {r.attempts > 1 && ` · ${r.attempts} tries`}
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
      toast.show({ tone: "success", message: `${KIND_WORDS[j.kind] ?? j.kind}: queued to run again.` });
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
      <h2 id="int-jobs">Background tasks</h2>
      <p className="ds-field__hint">Work that runs after a change is saved: notifications, image clean-up, retries. Failed tasks were tried 6 times.</p>
      <div className="adm-int__filters">
        <Select label="Show" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[{ value: "failed", label: "Failed" }, { value: "stuck", label: "Waiting too long" }, { value: "pending", label: "Waiting" }, { value: "done", label: "Done" }]} />
      </div>
      {res.error ? <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
        : !res.data ? <Skeleton width="100%" height={120} />
        : res.data.count === 0 ? <EmptyState title={status === "failed" ? "No failed tasks" : "Nothing here"}>{status === "failed" ? "Everything that ran has finished." : ""}</EmptyState>
        : (
          <ul className="adm-int__list">
            {res.data.results.map((j) => (
              <li key={j.id}>
                <span><strong>{KIND_WORDS[j.kind] ?? j.kind}</strong> · {j.status === "failed" ? "failed" : j.stuck ? "waiting too long" : j.status}
                  {` · ${j.attempts} of ${j.max_attempts} tries`}</span>
                <span className="adm-muted">
                  {j.status === "failed" && j.finished_at ? `Gave up ${formatDate(j.finished_at, { withTime: true })}` : `Next try ${formatDate(j.next_attempt_at, { withTime: true })}`}
                  {j.last_error && ` · ${j.last_error}`}
                  {j.request_id && ` · reference ${j.request_id.slice(0, 8)}`}
                </span>
                {(j.status === "failed" || j.status === "pending") && (
                  <span><Button size="sm" variant="secondary" loading={busy === j.id} loadingLabel="Retrying…" onClick={() => void retry(j)}>Retry</Button></span>
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
    document.title = "Integrations | NDCConnect admin";
  }, []);
  const o = res.data?.outbox;
  return (
    <div className="adm-page">
      <AdminNav current="integrations" />
      <header className="adm-page__head">
        <div>
          <h1>Integrations</h1>
          <p className="ds-field__hint">The outside services NDCConnect relies on, and the background work that connects to them.</p>
        </div>
      </header>
      {res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <>
          {o && (o.failed > 0 || o.stuck) && (
            <Banner tone={o.stuck ? "error" : "warning"} title={o.stuck ? "Background tasks are waiting too long" : "Some background tasks failed"}>
              {o.stuck ? `The oldest has waited ${Math.round(o.oldest_due_age_s / 60)} minutes. Check that process_outbox is running.`
                : `${o.failed} failed after every retry. Retry them below once the cause is fixed.`}
            </Banner>
          )}
          <section className="adm-panel" aria-labelledby="int-svc">
            <h2 id="int-svc">Services</h2>
            <Services services={res.data.services} />
            <p className="adm-muted">Updated {formatDate(res.data.generated_at, { withTime: true })} · {o?.pending ?? 0} background {o?.pending === 1 ? "task" : "tasks"} waiting.</p>
          </section>
          {res.data.webhooks.length > 0 && (
            <section className="adm-panel" aria-labelledby="int-24">
              <h2 id="int-24">Last 24 hours</h2>
              <ul className="adm-int__list">
                {res.data.webhooks.map((w) => (
                  <li key={w.provider}>
                    <span><strong>{PROVIDER_WORDS[w.provider] ?? w.provider}</strong></span>
                    <span>{w.processed} processed · {w.ignored} ignored · {w.failed} failed{w.bad_signatures ? ` · ${w.bad_signatures} with a bad signature` : ""}</span>
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
