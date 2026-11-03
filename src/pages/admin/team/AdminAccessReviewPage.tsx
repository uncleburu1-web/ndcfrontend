/** /admin/team/review — the 90-day access review (spec 14 §4.6): Keep or Revoke each grant, then Finish review. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, CANCELLED_REVERIFICATION } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import type { Assignment } from "../../../admin/types";
import { Banner, Button, EmptyState, Modal, Skeleton, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { AdminNav } from "../AdminNav";
import { TeamSubnav } from "./TeamSubnav";
import "../candidates/admin.css";
import "../../../privacy/privacy.css";

type Row = Assignment & { last_seen_at: string | null; mfa_enabled: boolean | null; inactive: boolean };
interface Review {
  due: boolean;
  last_review: { completed_at: string; by: string | null; kept: number; revoked: number } | null;
  results: Row[];
}

export default function AdminAccessReviewPage() {
  const api = useApi();
  const toast = useToast();
  const res = useRequest("access-review", (signal) => api<Review>("/admin/team/review/", { signal }));
  const [decisions, setDecisions] = useState<Record<string, "keep" | "revoked">>({});
  const [revoking, setRevoking] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = "Access review | NDCConnect admin";
  }, []);

  const rows = (res.data?.results ?? []).filter((r) => r.is_active);
  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/team/${revoking.id}/revoke/`, { method: "POST", body: { reason } });
      setDecisions((d) => ({ ...d, [revoking.id]: "revoked" }));
      toast.show({ tone: "success", message: `${revoking.role_label} revoked from ${revoking.user.full_name || revoking.user.email}.` });
      setRevoking(null);
      setReason("");
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : "Couldn’t revoke it.");
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    try {
      const kept = Object.values(decisions).filter((d) => d === "keep").length;
      const revoked = Object.values(decisions).filter((d) => d === "revoked").length;
      await api("/admin/team/review/", { method: "POST", body: { kept, revoked, notes } });
      toast.show({ tone: "success", message: "Access review recorded." });
      setDecisions({});
      res.retry();
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t record the review." });
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => !decisions[r.id]).length;
  return (
    <div className="adm-page">
      <AdminNav current="team" />
      <TeamSubnav />
      <header className="adm-page__head">
        <div>
          <h1>Access review</h1>
          <p className="ds-field__hint">
            Every 90 days, check that each admin role is still needed. Holders with no admin activity for 60 days are flagged.
            {res.data?.last_review && ` Last review ${formatDate(res.data.last_review.completed_at)}${res.data.last_review.by ? ` by ${res.data.last_review.by}` : ""}.`}
          </p>
        </div>
      </header>
      {res.data?.due && <Banner tone="warning" title="Access review due">Go through each grant below, then finish the review.</Banner>}
      {res.error ? (
        <Banner tone="error" title="We couldn’t load the review" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : rows.length === 0 ? (
        <EmptyState title="No active admin roles" />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Person and role</th><th>Granted</th><th>Last admin activity</th><th>Two-step</th><th>Decision</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const d = decisions[r.id];
                return (
                  <tr key={r.id}>
                    <td><Link to={`/admin/users/${r.user.id}`}>{r.user.full_name || r.user.email}</Link><br /><span className="privacy-meta">{r.role_label}{r.scope_label ? ` · ${r.scope_label}` : ""}</span></td>
                    <td>{formatDate(r.granted_at)}<br /><span className="privacy-meta">by {r.granted_by}</span></td>
                    <td>
                      {r.last_seen_at ? formatDate(r.last_seen_at) : "Never"}
                      {r.inactive && <><br /><span className="ds-badge ds-badge--warning">Inactive 60+ days</span></>}
                    </td>
                    <td>{r.mfa_enabled === true ? "On" : r.mfa_enabled === false ? "Off" : "Unknown"}</td>
                    <td>
                      {d === "revoked" ? "Revoked" : d === "keep" ? (
                        <>Keep <Button size="sm" variant="ghost" onClick={() => setDecisions((x) => { const n = { ...x }; delete n[r.id]; return n; })}>Undo</Button></>
                      ) : r.is_own ? "Your own role" : (
                        <div className="privacy-inline-actions">
                          <Button size="sm" variant="secondary" onClick={() => setDecisions((x) => ({ ...x, [r.id]: "keep" }))}>Keep</Button>
                          <Button size="sm" variant="danger" onClick={() => { setRevoking(r); setError(""); }}>Revoke</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {res.data && rows.length > 0 && (
        <section className="adm-panel">
          <TextArea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="privacy-meta">{pending ? `${pending} grant${pending === 1 ? "" : "s"} not decided yet.` : "Every grant decided."} You’ll be asked to confirm it’s you.</p>
          <Button onClick={finish} loading={busy}>Finish review</Button>
        </section>
      )}
      <Modal open={revoking !== null} onClose={() => setRevoking(null)} title="Revoke role"
        footer={<><Button variant="secondary" onClick={() => setRevoking(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => void revoke()}>Revoke role</Button></>}>
        {error && <Banner tone="error">{error}</Banner>}
        <p>{revoking?.role_label} from {revoking?.user.full_name || revoking?.user.email}.</p>
        <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} hint="e.g. no longer on the team; inactive 60 days" />
      </Modal>
    </div>
  );
}
