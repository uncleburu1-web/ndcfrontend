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
    document.title = "Account | NDCConnect admin";
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
        ? { tone: "warning", message: which === "deactivate" ? "Blocked on NDCConnect. The sign-in block in Clerk failed; try again." : "Reactivated here, but Clerk didn’t confirm. Try again." }
        : { tone: "success", message: which === "deactivate" ? "Account deactivated. They can’t sign in." : "Account reactivated." });
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
      toast.show({ tone: "success", message: "Role granted." });
      setModal(null);
      setRole("");
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: roleErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="team" /><EmptyState title="Account not found" action={<Button href="/admin/users">Back to users</Button>} /></div>;
  if (!u) return <div className="adm-page"><AdminNav current="team" /><Skeleton width="100%" height={240} /></div>;

  const banFailed = clerkFailed || (!u.is_active && u.deactivation?.clerk_ban === "failed");
  return (
    <div className="adm-page">
      <AdminNav current="team" />
      <TeamSubnav />
      <p className="adm-back"><Link to="/admin/users">← Users</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{u.deleted ? "Deleted account" : u.full_name || u.email}</h1>
          <div className="adm-status"><StatusBadge set="account" status={accountStatus(u)} />{u.is_self && <span>This is you</span>}</div>
        </div>
        <div className="adm-actions">
          {!u.deleted && !u.is_self && u.is_active && <Button variant="secondary" onClick={() => setModal("deactivate")}>Deactivate</Button>}
          {!u.deleted && !u.is_self && !u.is_active && <Button variant="secondary" onClick={() => setModal("reactivate")}>Reactivate</Button>}
        </div>
      </header>
      {banFailed && (
        <Banner tone="warning" title="Sign-in block failed"
          action={<Button size="sm" variant="secondary" loading={busy} onClick={() => void act("deactivate", u.deactivation?.reason || "Retry sign-in block")}>Retry sign-in block</Button>}>
          Blocked on NDCConnect. The sign-in block in Clerk failed; try again.
        </Banner>
      )}
      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="facts-title">
          <h2 id="facts-title">Account</h2>
          <dl className="adm-facts">
            <dt>Email</dt><dd>{u.email || "—"}</dd>
            <dt>Phone</dt>
            <dd>{phone || u.phone_masked || "—"} {!phone && u.phone_masked && <Button size="sm" variant="ghost" onClick={() => void reveal()}>Show</Button>}</dd>
            <dt>Joined</dt><dd>{formatDate(u.joined_at)}</dd>
            <dt>Profile</dt><dd>{u.profile_complete ? "Complete" : "Incomplete"} · last updated {formatDate(u.updated_at)}</dd>
            {u.deactivation && (
              <><dt>Deactivated</dt><dd>{formatDate(u.deactivation.at, { withTime: true })} by {u.deactivation.by}{u.deactivation.reason ? ` — ${u.deactivation.reason}` : ""}</dd></>
            )}
            {u.clerk_deleted_at && <><dt>Deleted in Clerk</dt><dd>{formatDate(u.clerk_deleted_at)}</dd></>}
          </dl>
        </section>
        <section className="adm-panel" aria-labelledby="actions-title">
          <h2 id="actions-title">Recent actions by this account</h2>
          {u.recent_actions.length ? <ul className="adm-activity">{u.recent_actions.map((e) => <ActivityRow key={e.id} e={e} />)}</ul>
            : <p className="adm-muted">None recorded.</p>}
          {u.email && <p><Link to={`/admin/audit?actor=${encodeURIComponent(u.email)}`}>See all in the audit log</Link></p>}
        </section>
      </div>
      <section className="adm-panel" aria-labelledby="roles-title">
        <div className="adm-page__head">
          <h2 id="roles-title">Roles</h2>
          {!u.is_self && u.is_active && !u.deleted && <Button size="sm" variant="secondary" onClick={() => setModal("grant")}>Grant a role</Button>}
        </div>
        {u.assignments.length ? <RoleRows rows={u.assignments} showUser={false} onChanged={res.retry} /> : <p className="adm-muted">No roles.</p>}
      </section>

      <Modal open={modal === "deactivate" || modal === "reactivate"} onClose={() => setModal(null)}
        title={modal === "deactivate" ? "Deactivate this account?" : "Reactivate this account?"}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button variant={modal === "deactivate" ? "danger" : "primary"} loading={busy} disabled={modal === "deactivate" && !reason.trim()}
            onClick={() => modal && modal !== "grant" && void act(modal)}>{modal === "deactivate" ? "Deactivate" : "Reactivate"}</Button></>}>
        <p>{modal === "deactivate" ? "They’re signed out and can’t sign in or use NDCConnect until reactivated." : "They can sign in again."}</p>
        <TextArea label={modal === "deactivate" ? "Reason" : "Reason (optional)"} required={modal === "deactivate"} rows={2} value={reason}
          onChange={(e) => setReason(e.target.value)} />
      </Modal>
      <Modal open={modal === "grant"} onClose={() => setModal(null)} title="Grant a role"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button><Button loading={busy} disabled={!role} onClick={() => void grant()}>Grant role</Button></>}>
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}
          options={[{ value: "", label: "Choose a role" }, ...(grantable.data?.grantable ?? []).map((g) => ({ value: g.role, label: g.label }))]} />
        {role === "system_admin" && <Banner tone="warning">This gives full access to every admin area, including donations, membership and the audit log.</Banner>}
        <TextField label="Email" value={u.email} readOnly />
      </Modal>
    </div>
  );
}
