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
import { t } from "../../../i18n";

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
    document.title = t("admin.access-review-ndcconnect-admin");
  }, []);

  const rows = (res.data?.results ?? []).filter((r) => r.is_active);
  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/team/${revoking.id}/revoke/`, { method: "POST", body: { reason } });
      setDecisions((d) => ({ ...d, [revoking.id]: "revoked" }));
      toast.show({ tone: "success", message: t("admin.revoked-from", { role_label: revoking.role_label, v: revoking.user.full_name || revoking.user.email }) });
      setRevoking(null);
      setReason("");
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : t("admin.couldn-t-revoke-it"));
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
      toast.show({ tone: "success", message: t("admin.access-review-recorded") });
      setDecisions({});
      res.retry();
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-record-the-review") });
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
          <h1>{t("admin.access-review")}</h1>
          <p className="ds-field__hint">
            {t("admin.every-90-days-check-that-each", { v: res.data?.last_review && t("admin.last-review", { formatDate: formatDate(res.data.last_review.completed_at), v: res.data.last_review.by ? t("admin.by-6", { by: res.data.last_review.by }) : "" }) })}
          </p>
        </div>
      </header>
      {res.data?.due && <Banner tone="warning" title={t("admin.access-review-due")}>{t("admin.go-through-each-grant-below-then")}</Banner>}
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-the-review")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("admin.no-active-admin-roles")} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>{t("admin.person-and-role")}</th><th>{t("admin.granted")}</th><th>{t("admin.last-admin-activity")}</th><th>{t("admin.two-step")}</th><th>{t("admin.decision")}</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const d = decisions[r.id];
                return (
                  <tr key={r.id}>
                    <td><Link to={`/admin/users/${r.user.id}`}>{r.user.full_name || r.user.email}</Link><br /><span className="privacy-meta">{r.role_label}{r.scope_label ? ` · ${r.scope_label}` : ""}</span></td>
                    <td>{formatDate(r.granted_at)}<br /><span className="privacy-meta">{t("admin.by-7", { granted_by: r.granted_by })}</span></td>
                    <td>
                      {r.last_seen_at ? formatDate(r.last_seen_at) : t("admin.never")}
                      {r.inactive && <><br /><span className="ds-badge ds-badge--warning">{t("admin.inactive-60-days")}</span></>}
                    </td>
                    <td>{r.mfa_enabled === true ? t("admin.on") : r.mfa_enabled === false ? t("admin.off") : t("admin.unknown")}</td>
                    <td>
                      {d === "revoked" ? t("admin.revoked-2") : d === "keep" ? (
                        <>{t.rich("admin.keep-undo", { button: (chunks) => <Button size="sm" variant="ghost" onClick={() => setDecisions((x) => { const n = { ...x }; delete n[r.id]; return n; })}>{chunks}</Button> })}</>
                      ) : r.is_own ? t("admin.your-own-role") : (
                        <div className="privacy-inline-actions">
                          <Button size="sm" variant="secondary" onClick={() => setDecisions((x) => ({ ...x, [r.id]: "keep" }))}>{t("admin.keep")}</Button>
                          <Button size="sm" variant="danger" onClick={() => { setRevoking(r); setError(""); }}>{t("admin.revoke")}</Button>
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
          <TextArea label={t("admin.notes-optional")} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="privacy-meta">{t("admin.you-ll-be-asked-to-confirm-3", { v: pending ? t("admin.grant-not-decided-yet", { pending, v: pending === 1 ? "" : "s" }) : t("admin.every-grant-decided") })}</p>
          <Button onClick={finish} loading={busy}>{t("admin.finish-review")}</Button>
        </section>
      )}
      <Modal open={revoking !== null} onClose={() => setRevoking(null)} title={t("admin.revoke-role")}
        footer={<><Button variant="secondary" onClick={() => setRevoking(null)}>{t("admin.cancel")}</Button>
          <Button variant="danger" loading={busy} onClick={() => void revoke()}>{t("admin.revoke-role")}</Button></>}>
        {error && <Banner tone="error">{error}</Banner>}
        <p>{t("admin.from-3", { role_label: revoking?.role_label, v: revoking?.user.full_name || revoking?.user.email })}</p>
        <TextField label={t("admin.reason")} required value={reason} onChange={(e) => setReason(e.target.value)} hint={t("admin.e-g-no-longer-on-the")} />
      </Modal>
    </div>
  );
}
