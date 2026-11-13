/** Role assignment rows with Revoke (spec 11 §4.3), shared by the Team page and the account page. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Button, Modal, StatusBadge, TextArea, useToast } from "../components/ui";
import { formatDate } from "../lib/format";
import type { Assignment } from "./types";
import { t } from "../i18n";

export function roleErrorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "That didn’t work. Try again.";
}

export function RoleRows({ rows, showUser = true, onChanged }: { rows: Assignment[]; showUser?: boolean; onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [revoking, setRevoking] = useState<Assignment | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await api(`/admin/team/${revoking.id}/revoke/`, { method: "POST", body: { reason } });
      toast.show({ tone: "success", message: t("admin.removed-from", { role_label: revoking.role_label, v: revoking.user.full_name || revoking.user.email }) });
      setRevoking(null);
      setReason("");
      onChanged();
    } catch (err) {
      toast.show({ tone: "error", message: roleErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr>{showUser && <th>{t("admin.person")}</th>}<th>{t("admin.role")}</th><th>{t("admin.where")}</th><th>{t("admin.granted")}</th><th><span className="visually-hidden">{t("admin.actions")}</span></th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              {showUser && (
                <td><Link to={`/admin/users/${a.user.id}`}>{a.user.full_name || a.user.email || t("admin.deleted-account")}</Link><br />
                  <span className="ds-field__hint">{a.user.email}</span></td>
              )}
              <td>{a.role_label}{a.note && <><br /><span className="ds-field__hint">{a.note}</span></>}</td>
              <td>{a.scope_label}</td>
              <td>
                {formatDate(a.granted_at)} · {a.granted_by}
                {!a.is_active && <><br /><StatusBadge set="role" status="revoked" /> <span className="ds-field__hint">{t("admin.revoked", { v: a.revoked_at ? formatDate(a.revoked_at) : "", v2: a.revoked_by ? t("admin.by", { revoked_by: a.revoked_by }) : "" })}</span></>}
              </td>
              <td>
                {!a.is_active ? null : a.role === "candidate" ? (
                  a.scope_id ? <Link to={`/admin/candidates/${a.scope_id}`}>{t("admin.manage-on-the-candidate-page")}</Link> : null
                ) : a.is_own ? (
                  <span className="ds-field__hint">{t("admin.you")}</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => { setReason(""); setRevoking(a); }}
                    aria-label={t("admin.revoke-from", { role_label: a.role_label, v: a.user.full_name || a.user.email })}>{t("admin.revoke")}</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <Modal open={Boolean(revoking)} onClose={() => setRevoking(null)} title={revoking ? t("admin.remove", { role_label: revoking.role_label }) : ""}
        footer={<><Button variant="secondary" onClick={() => setRevoking(null)}>{t("admin.go-back")}</Button>
          <Button variant="danger" loading={busy} onClick={() => void revoke()}>{t("admin.revoke-role")}</Button></>}>
        <p>{t("admin.loses-access-straight-away", { v: revoking?.user.full_name || revoking?.user.email })}</p>
        <TextArea label={t("admin.reason-optional")} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
