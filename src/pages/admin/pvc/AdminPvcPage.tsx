/**
 * /admin/pvc — PVC officers (and membership officers) check PVCs by hand on INEC's checker (spec 06 §4.4, spec 08 §4.4).
 * NDCConnect sends nothing to INEC: the checker has no API and a security check.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, MaskedValue, Modal, Pagination, Select, Skeleton, StatusBadge, TextArea, useToast } from "../../../components/ui";
import { GeoPicker } from "../../../geo/GeoPicker";
import { geoBody, geoFrom, type GeoValue } from "../../../geo/types";
import { formatDate, workingDaysSince } from "../../../lib/format";
import { STATES } from "../../../lib/nigeria";
import type { AdminPvc, AdminPvcPage } from "../../../pvc/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "./admin-pvc.css";
import { t as tr } from "../../../i18n";

export const REJECT_REASONS = [
  "The details don’t match INEC’s record.",
  "INEC’s checker doesn’t find this VIN.",
  "The VIN is incomplete or unreadable.",
  "Other",
];
export { workingDaysSince }; // moved to lib/format (shared with the Admin home, spec 11)

export function waitText(from: string, now = new Date()) {
  const ms = now.getTime() - new Date(from).getTime();
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)} day${Math.floor(h / 24) === 1 ? "" : "s"} ${h % 24} hour${h % 24 === 1 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"}`;
}

const EVENT_LABELS: Record<string, string> = {
  get submitted() { return tr("admin.submitted"); }, get details_changed() { return tr("admin.details-changed"); }, get withdrawn() { return tr("admin.withdrawn"); }, get verified() { return tr("admin.verified"); }, get rejected() { return tr("admin.rejected"); },
  get vin_revealed() { return tr("admin.vin-revealed"); }, get vin_pruned() { return tr("admin.vin-deleted-retention"); }, get badge_changed() { return tr("admin.badge-setting-changed"); },
};

const TABS = [
  { id: "pending", get label() { return tr("admin.pending"); } },
  { id: "successful", get label() { return tr("admin.verified"); } },
  { id: "rejected", get label() { return tr("admin.rejected"); } },
];

export default function AdminPvcPage() {
  const api = useApi();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "pending";
  const state = params.get("state") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const key = `admin-pvc:${status}:${state}:${page}`;
  const res = useRequest(key, (signal) =>
    api<AdminPvcPage>(`/admin/pvc/?status=${status}${state ? `&state=${state}` : ""}${page > 1 ? `&page=${page}` : ""}`, { signal }));
  const setFilter = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v && !(k === "status" && v === "pending") ? next.set(k, v) : next.delete(k));
    next.delete("page");
    setParams(next);
  };
  const [rejecting, setRejecting] = useState<AdminPvc | null>(null);
  const [preset, setPreset] = useState(REJECT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    document.title = tr("admin.pvc-checks-ndcconnect-admin");
  }, []);

  // Spec 19 §8.2: the officer confirms the polling unit INEC's checker shows; pre-filled with the link or the best match
  const [geo, setGeo] = useState<Record<string, GeoValue>>({});
  const geoFor = (r: AdminPvc): GeoValue => geo[r.id] ?? (() => {
    const base = geoFrom(r.place, { lga: r.lga, polling_unit: r.polling_unit });
    const s = r.suggestion;
    return base.polling_unit_id || !s ? base
      : { ...base, lga_id: s.lga?.id ?? null, ward_id: s.ward?.id ?? null, polling_unit_id: s.polling_unit?.id ?? null };
  })();
  const verify = async (r: AdminPvc) => {
    setBusy(r.id);
    const g = geoFor(r);
    try {
      await api(`/admin/pvc/${r.id}/verify/`, { method: "POST", body: g.polling_unit_id ? geoBody(g, false) : {} });
      toast.show({ tone: "success", message: tr("admin.s-pvc-marked-verified", { user_name: r.user_name }) });
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : tr("admin.couldn-t-verify") });
    } finally {
      setBusy("");
    }
  };
  const reject = async () => {
    if (!rejecting) return;
    const reason = preset === "Other" ? detail.trim() : [preset, detail.trim()].filter(Boolean).join(" ");
    setBusy(rejecting.id);
    try {
      await api(`/admin/pvc/${rejecting.id}/reject/`, { method: "POST", body: { reason } });
      toast.show({ tone: "success", message: tr("admin.pvc-rejected-the-voter-sees-your") });
      setRejecting(null);
      setDetail("");
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : tr("admin.couldn-t-reject") });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="adm-page">
      <AdminNav current="pvc" />
      <header className="adm-page__head">
        <div>
          <h1>{tr("admin.pvc-checks")}</h1>
          <p className="ds-field__hint">{tr("admin.private-reveal-the-vin-check-it")}</p>
        </div>
        <Button variant="ghost" href="/admin/pvc/settings">{tr("admin.guidance-settings")}</Button>
        {res.data?.lookup_url && (
          <Button variant="secondary" href={res.data.lookup_url} target="_blank" rel="noopener noreferrer">{tr("admin.open-inec-voter-checker")}</Button>
        )}
      </header>
      <div className="adm-pvc-filters">
        <Select label={tr("admin.show")} value={status} onChange={(e) => setFilter({ status: e.target.value })}
          options={TABS.map((t) => ({ value: t.id, label: t.id === "pending" && res.data ? `${t.label} (${res.data.pending_count})` : t.label }))} />
        <Select label={tr("admin.state")} value={state} onChange={(e) => setFilter({ state: e.target.value })}
          options={[{ value: "", label: tr("admin.all-states") }, ...STATES]} />
      </div>
      {status === "pending" && res.data?.oldest_pending_at && (
        <Banner tone={workingDaysSince(new Date(res.data.oldest_pending_at)) > 3 ? "warning" : "info"}
          title={tr("admin.oldest-pending", { waitText: waitText(res.data.oldest_pending_at) })}>
          {workingDaysSince(new Date(res.data.oldest_pending_at)) > 3 ? tr("admin.past-the-3-working-days-we") : tr("admin.voters-are-told-checks-take-up")}
        </Banner>
      )}

      {res.error ? (
        <Banner tone="error" title={tr("admin.we-couldn-t-load-pvc-checks")} action={<Button variant="secondary" size="sm" onClick={res.retry}>{tr("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={status === "pending" ? tr("admin.no-pvcs-waiting") : tr("admin.nothing-here-yet")}>{status === "pending" ? tr("admin.new-submissions-appear-here-oldest-first") : ""}</EmptyState>
      ) : res.data ? (
        <>
          <ul className="adm-pvc-list">
            {res.data.results.map((r) => (
              <li key={r.id} className="adm-panel adm-pvc">
                <div className="adm-pvc__head">
                  <div>
                    <h2>{r.user_name || r.user_email}</h2>
                    <p className="ds-field__hint">{tr("admin.submitted-2", { user_email: r.user_email, v: r.created_at ? formatDate(r.created_at, { withTime: true }) : "" })}</p>
                  </div>
                  <StatusBadge set="pvc" status={r.status} />
                </div>
                <dl className="adm-dl">
                  <div><dt>{tr("admin.vin")}</dt><dd><MaskedValue masked={r.vin_masked ?? ""} label="VIN"
                    onReveal={async () => (await api<{ vin: string }>(`/admin/pvc/${r.id}/reveal/`, { method: "POST" })).vin} /></dd></div>
                  <div><dt>{tr("admin.surname")}</dt><dd>{r.surname}</dd></div>
                  <div><dt>{tr("admin.state-lga")}</dt><dd>{r.state_label}, {r.lga}</dd></div>
                  {r.polling_unit && <div><dt>{tr("admin.polling-unit")}</dt><dd>{r.polling_unit}</dd></div>}
                  {r.reviewed_at && <div><dt>{tr("admin.decided-2")}</dt><dd>{formatDate(r.reviewed_at, { withTime: true })}{r.reviewed_by_email ? tr("admin.by-5", { reviewed_by_email: r.reviewed_by_email }) : ""}</dd></div>}
                  {r.reason && <div><dt>{tr("admin.reason")}</dt><dd>{r.reason}</dd></div>}
                </dl>
                {r.events?.length > 0 && (
                  <details className="adm-pvc__history">
                    <summary>{tr("admin.history-2", { length: r.events.length })}</summary>
                    <ol className="adm-history">
                      {r.events.map((e, i) => (
                        <li key={i}>{EVENT_LABELS[e.kind] ?? e.kind} · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
                      ))}
                    </ol>
                  </details>
                )}
                {r.status === "pending" && r.is_own && <Banner tone="info">{tr("admin.this-is-your-own-check-another")}</Banner>}
                {r.status === "pending" && !r.is_own && (
                  <details className="adm-pvc__history" open>
                    <summary>{tr("admin.polling-unit-from-inec-s-checker")}</summary>
                    <GeoPicker state={r.state ?? ""} value={geoFor(r)} onChange={(v) => setGeo((m) => ({ ...m, [r.id]: v }))} allowNotListed={false}
                      hint={tr("admin.choose-the-polling-unit-the-checker")} />
                  </details>
                )}
                {r.status === "pending" && !r.is_own && (
                  <div className="adm-actions">
                    <Button size="sm" onClick={() => void verify(r)} loading={busy === r.id} loadingLabel={tr("admin.saving")}>{tr("admin.mark-verified")}</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setRejecting(r); setPreset(REJECT_REASONS[0]); setDetail(""); }}>{tr("admin.reject")}</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label={tr("admin.pvc-pages")}
            onChange={(p) => setParams({ ...(status !== "pending" ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) })} />
        </>
      ) : null}

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={tr("admin.reject-s-pvc", { v: rejecting?.user_name ?? "" })}
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>{tr("admin.keep-pending")}</Button>
          <Button variant="danger" onClick={() => void reject()} disabled={preset === "Other" && !detail.trim()} loading={busy === rejecting?.id}>{tr("admin.reject-pvc")}</Button></>}>
        <p>{tr("admin.the-voter-sees-this-reason-and")}</p>
        <Select label={tr("admin.reason")} value={preset} onChange={(e) => setPreset(e.target.value)} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />
        <TextArea label={preset === "Other" ? tr("admin.reason") : tr("admin.more-detail-optional")} required={preset === "Other"} rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Modal>
    </div>
  );
}
