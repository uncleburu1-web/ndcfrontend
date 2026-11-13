/**
 * /admin/users/:id — one account (spec 11 §4.4). Account facts, roles and their own recent actions only.
 * Opening this page is audited; so is revealing the phone number.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Modal, Select, Skeleton, StatusBadge, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ActivityRow } from "../../../admin/AdminParts";
import { RoleRows, roleErrorMessage } from "../../../admin/RoleRows";
import type { Assignment, GrantableRole, UserDetail } from "../../../admin/types";
import { AdminNav } from "../AdminNav";
import { TeamSubnav } from "../team/TeamSubnav";
import { accountStatus } from "./AdminUsersPage";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../../../admin/admin-home.css";
import { t } from "../../../i18n";

export default function AdminUserPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`admin-user:${id}`, (signal) => api<UserDetail>(`/admin/users/${id}/`, { signal }));
  const grantable = useRequest("admin-grantable", (signal) => api<{ grantable: GrantableRole[] }>("/admin/team/", { signal }));
  const [u, setU] = useState<UserDetail | null>(null);
  const [phone, setPhone] = useState("");
  const [modal, setModal] = useState<"deactivate" | "reactivate" | "grant" | null>(null);
  const [reason, setReason] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [clerkFailed, setClerkFailed] = useState(false);
  useEffect(() => setU(res.data), [res.data]);
  useEffect(() => {
    document.title = t("admin.account-ndcconnect-admin");
  }, []);

  const reveal = async () => {
    try {
      setPhone((await api<{ phone_number: string }>(`/admin/users/${id}/phone/`, { method: "POST" })).phone_number);
    } catch (err) {
      toast.show({ tone: "error", message: roleErrorMessage(err) });
    }
  };
  const act = async (which: "deactivate" | "reactivate", why = reason) => {
    setBusy(true);
    try {
      const r = await api<{ user: UserDetail; clerk_ban?: string; clerk_unban?: string }>(`/admin/users/${id}/${which}/`,
        { method: "POST", body: { reason: why } });
      setU(r.user);
      const failed = (r.clerk_ban ?? r.clerk_unban) === "failed";
      setClerkFailed(which === "deactivate" && failed);
      toast.show(failed
        ? { tone: "warning", message: which === "deactivate" ? t("admin.blocked-on-ndcconnect-the-sign-in") : t("admin.reactivated-here-but-clerk-didn-t") }
        : { tone: "success", message: which === "deactivate" ? t("admin.account-deactivated-they-can-t-sign") : t("admin.account-reactivated") });
      setModal(null);
      setReason("");
    } catch (err) {
      toast.show({ tone: "error", message: roleErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const grant = async () => {
    if (!u) return;
    setBusy(true);
    try {
      await api<Assignment>("/admin/team/", { method: "POST", body: { email: u.email, role } });
      toast.show({ tone: "success", message: t("admin.role-granted") });
      setModal(null);
      setRole("");
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: roleErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="team" /><EmptyState title={t("admin.account-not-found")} action={<Button href="/admin/users">{t("admin.back-to-users")}</Button>} /></div>;
  if (!u) return <div className="adm-page"><AdminNav current="team" /><Skeleton width="100%" height={240} /></div>;

  const banFailed = clerkFailed || (!u.is_active && u.deactivation?.clerk_ban === "failed");
  return (
    <div className="adm-page">
      <AdminNav current="team" />
      <TeamSubnav />
      <p className="adm-back"><Link to="/admin/users">{t("admin.users-2")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{u.deleted ? t("admin.deleted-account") : u.full_name || u.email}</h1>
          <div className="adm-status"><StatusBadge set="account" status={accountStatus(u)} />{u.is_self && <span>{t("admin.this-is-you")}</span>}</div>
        </div>
        <div className="adm-actions">
          {!u.deleted && !u.is_self && u.is_active && <Button variant="secondary" onClick={() => setModal("deactivate")}>{t("admin.deactivate")}</Button>}
          {!u.deleted && !u.is_self && !u.is_active && <Button variant="secondary" onClick={() => setModal("reactivate")}>{t("admin.reactivate")}</Button>}
        </div>
      </header>
      {banFailed && (
        <Banner tone="warning" title={t("admin.sign-in-block-failed")}
          action={<Button size="sm" variant="secondary" loading={busy} onClick={() => void act("deactivate", u.deactivation?.reason || t("admin.retry-sign-in-block"))}>{t("admin.retry-sign-in-block")}</Button>}>
          {t("admin.blocked-on-ndcconnect-the-sign-in")}</Banner>
      )}
      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="facts-title">
          <h2 id="facts-title">{t("admin.account")}</h2>
          <dl className="adm-facts">
            <dt>{t("admin.email")}</dt><dd>{u.email || "—"}</dd>
            <dt>{t("admin.phone")}</dt>
            <dd>{phone || u.phone_masked || "—"} {!phone && u.phone_masked && <Button size="sm" variant="ghost" onClick={() => void reveal()}>{t("admin.show")}</Button>}</dd>
            <dt>{t("admin.joined")}</dt><dd>{formatDate(u.joined_at)}</dd>
            <dt>{t("admin.profile")}</dt><dd>{t("admin.last-updated", { v: u.profile_complete ? t("admin.complete") : t("admin.incomplete"), formatDate: formatDate(u.updated_at) })}</dd>
            {u.deactivation && (
              <><dt>{t("admin.deactivated")}</dt><dd>{t("admin.by-8", { formatDate: formatDate(u.deactivation.at, { withTime: true }), by: u.deactivation.by, v: u.deactivation.reason ? ` — ${u.deactivation.reason}` : "" })}</dd></>
            )}
            {u.clerk_deleted_at && <><dt>{t("admin.deleted-in-clerk")}</dt><dd>{formatDate(u.clerk_deleted_at)}</dd></>}
          </dl>
        </section>
        <section className="adm-panel" aria-labelledby="actions-title">
          <h2 id="actions-title">{t("admin.recent-actions-by-this-account")}</h2>
          {u.recent_actions.length ? <ul className="adm-activity">{u.recent_actions.map((e) => <ActivityRow key={e.id} e={e} />)}</ul>
            : <p className="adm-muted">{t("admin.none-recorded")}</p>}
          {u.email && <p><Link to={`/admin/audit?actor=${encodeURIComponent(u.email)}`}>{t("admin.see-all-in-the-audit-log")}</Link></p>}
        </section>
      </div>
      <section className="adm-panel" aria-labelledby="roles-title">
        <div className="adm-page__head">
          <h2 id="roles-title">{t("admin.roles")}</h2>
          {!u.is_self && u.is_active && !u.deleted && <Button size="sm" variant="secondary" onClick={() => setModal("grant")}>{t("admin.grant-a-role")}</Button>}
        </div>
        {u.assignments.length ? <RoleRows rows={u.assignments} showUser={false} onChanged={res.retry} /> : <p className="adm-muted">{t("admin.no-roles")}</p>}
      </section>

      <Modal open={modal === "deactivate" || modal === "reactivate"} onClose={() => setModal(null)}
        title={modal === "deactivate" ? t("admin.deactivate-this-account") : t("admin.reactivate-this-account")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button variant={modal === "deactivate" ? "danger" : "primary"} loading={busy} disabled={modal === "deactivate" && !reason.trim()}
            onClick={() => modal && modal !== "grant" && void act(modal)}>{modal === "deactivate" ? t("admin.deactivate") : t("admin.reactivate")}</Button></>}>
        <p>{modal === "deactivate" ? t("admin.they-re-signed-out-and-can") : t("admin.they-can-sign-in-again")}</p>
        <TextArea label={modal === "deactivate" ? t("admin.reason") : t("admin.reason-optional")} required={modal === "deactivate"} rows={2} value={reason}
          onChange={(e) => setReason(e.target.value)} />
      </Modal>
      <Modal open={modal === "grant"} onClose={() => setModal(null)} title={t("admin.grant-a-role")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button><Button loading={busy} disabled={!role} onClick={() => void grant()}>{t("admin.grant-role")}</Button></>}>
        <Select label={t("admin.role")} value={role} onChange={(e) => setRole(e.target.value)}
          options={[{ value: "", label: t("admin.choose-a-role") }, ...(grantable.data?.grantable ?? []).map((g) => ({ value: g.role, label: g.label }))]} />
        {role === "system_admin" && <Banner tone="warning">{t("admin.this-gives-full-access-to-every")}</Banner>}
        <TextField label={t("admin.email")} value={u.email} readOnly />
      </Modal>
    </div>
  );
}
