/**
 * /admin/pvc — membership officers check PVCs by hand on INEC's checker (spec 06 §4.4, §6.2).
 * NDCConnect sends nothing to INEC: the checker has no API and a security check.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, MaskedValue, Modal, Pagination, Select, Skeleton, StatusBadge, TextArea, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { AdminPvc, AdminPvcPage } from "../../../pvc/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "./admin-pvc.css";

export const REJECT_REASONS = [
  "The details don’t match INEC’s record.",
  "INEC’s checker doesn’t find this VIN.",
  "The VIN is incomplete or unreadable.",
  "Other",
];
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
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const key = `admin-pvc:${status}:${page}`;
  const res = useRequest(key, (signal) => api<AdminPvcPage>(`/admin/pvc/?status=${status}${page > 1 ? `&page=${page}` : ""}`, { signal }));
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
        {res.data?.lookup_url && (
          <Button variant="secondary" href={res.data.lookup_url} target="_blank" rel="noopener noreferrer">Open INEC voter checker</Button>
        )}
      </header>
      <div className="adm-pvc-filter">
        <Select label="Show" value={status} onChange={(e) => setParams(e.target.value === "pending" ? {} : { status: e.target.value })}
          options={TABS.map((t) => ({ value: t.id, label: t.id === "pending" && res.data ? `${t.label} (${res.data.pending_count})` : t.label }))} />
      </div>

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
                {r.status === "pending" && (
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
