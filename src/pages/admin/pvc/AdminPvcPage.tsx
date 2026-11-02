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
import { formatDate, workingDaysSince } from "../../../lib/format";
import { STATES } from "../../../lib/nigeria";
import type { AdminPvc, AdminPvcPage } from "../../../pvc/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "./admin-pvc.css";

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
  submitted: "Submitted", details_changed: "Details changed", withdrawn: "Withdrawn", verified: "Verified", rejected: "Rejected",
  vin_revealed: "VIN revealed", vin_pruned: "VIN deleted (retention)", badge_changed: "Badge setting changed",
};

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "successful", label: "Verified" },
  { id: "rejected", label: "Rejected" },
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
    document.title = "PVC checks | NDCConnect admin";
  }, []);

  const verify = async (r: AdminPvc) => {
    setBusy(r.id);
    try {
      await api(`/admin/pvc/${r.id}/verify/`, { method: "POST" });
      toast.show({ tone: "success", message: `${r.user_name}’s PVC marked verified.` });
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t verify." });
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
      toast.show({ tone: "success", message: "PVC rejected. The voter sees your reason." });
      setRejecting(null);
      setDetail("");
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t reject." });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="adm-page">
      <AdminNav current="pvc" />
      <header className="adm-page__head">
        <div>
          <h1>PVC checks</h1>
          <p className="ds-field__hint">Private. Reveal the VIN, check it on INEC’s voter checker, then mark the result. Reveals are audited.</p>
        </div>
        <Button variant="ghost" href="/admin/pvc/settings">Guidance settings</Button>
        {res.data?.lookup_url && (
          <Button variant="secondary" href={res.data.lookup_url} target="_blank" rel="noopener noreferrer">Open INEC voter checker</Button>
        )}
      </header>
      <div className="adm-pvc-filters">
        <Select label="Show" value={status} onChange={(e) => setFilter({ status: e.target.value })}
          options={TABS.map((t) => ({ value: t.id, label: t.id === "pending" && res.data ? `${t.label} (${res.data.pending_count})` : t.label }))} />
        <Select label="State" value={state} onChange={(e) => setFilter({ state: e.target.value })}
          options={[{ value: "", label: "All states" }, ...STATES]} />
      </div>
      {status === "pending" && res.data?.oldest_pending_at && (
        <Banner tone={workingDaysSince(new Date(res.data.oldest_pending_at)) > 3 ? "warning" : "info"}
          title={`Oldest pending: ${waitText(res.data.oldest_pending_at)}`}>
          {workingDaysSince(new Date(res.data.oldest_pending_at)) > 3
            ? "Past the 3 working days we promise voters. Please clear the oldest checks first."
            : "Voters are told checks take up to 3 working days."}
        </Banner>
      )}

      {res.error ? (
        <Banner tone="error" title="We couldn’t load PVC checks" action={<Button variant="secondary" size="sm" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={status === "pending" ? "No PVCs waiting" : "Nothing here yet"}>{status === "pending" ? "New submissions appear here, oldest first." : ""}</EmptyState>
      ) : res.data ? (
        <>
          <ul className="adm-pvc-list">
            {res.data.results.map((r) => (
              <li key={r.id} className="adm-panel adm-pvc">
                <div className="adm-pvc__head">
                  <div>
                    <h2>{r.user_name || r.user_email}</h2>
                    <p className="ds-field__hint">{r.user_email} · submitted {r.created_at ? formatDate(r.created_at, { withTime: true }) : ""}</p>
                  </div>
                  <StatusBadge set="pvc" status={r.status} />
                </div>
                <dl className="adm-dl">
                  <div><dt>VIN</dt><dd><MaskedValue masked={r.vin_masked ?? ""} label="VIN"
                    onReveal={async () => (await api<{ vin: string }>(`/admin/pvc/${r.id}/reveal/`, { method: "POST" })).vin} /></dd></div>
                  <div><dt>Surname</dt><dd>{r.surname}</dd></div>
                  <div><dt>State / LGA</dt><dd>{r.state_label}, {r.lga}</dd></div>
                  {r.polling_unit && <div><dt>Polling unit</dt><dd>{r.polling_unit}</dd></div>}
                  {r.reviewed_at && <div><dt>Decided</dt><dd>{formatDate(r.reviewed_at, { withTime: true })}{r.reviewed_by_email ? ` by ${r.reviewed_by_email}` : ""}</dd></div>}
                  {r.reason && <div><dt>Reason</dt><dd>{r.reason}</dd></div>}
                </dl>
                {r.events?.length > 0 && (
                  <details className="adm-pvc__history">
                    <summary>History ({r.events.length})</summary>
                    <ol className="adm-history">
                      {r.events.map((e, i) => (
                        <li key={i}>{EVENT_LABELS[e.kind] ?? e.kind} · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
                      ))}
                    </ol>
                  </details>
                )}
                {r.status === "pending" && r.is_own && <Banner tone="info">This is your own check. Another officer has to decide it.</Banner>}
                {r.status === "pending" && !r.is_own && (
                  <div className="adm-actions">
                    <Button size="sm" onClick={() => void verify(r)} loading={busy === r.id} loadingLabel="Saving…">Mark verified</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setRejecting(r); setPreset(REJECT_REASONS[0]); setDetail(""); }}>Reject</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label="PVC pages"
            onChange={(p) => setParams({ ...(status !== "pending" ? { status } : {}), ...(p > 1 ? { page: String(p) } : {}) })} />
        </>
      ) : null}

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.user_name ?? ""}’s PVC?`}
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Keep pending</Button>
          <Button variant="danger" onClick={() => void reject()} disabled={preset === "Other" && !detail.trim()} loading={busy === rejecting?.id}>Reject PVC</Button></>}>
        <p>The voter sees this reason and can try again.</p>
        <Select label="Reason" value={preset} onChange={(e) => setPreset(e.target.value)} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />
        <TextArea label={preset === "Other" ? "Reason" : "More detail (optional)"} required={preset === "Other"} rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Modal>
    </div>
  );
}
