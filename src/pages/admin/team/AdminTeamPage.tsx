/** /admin/team — system admins grant and revoke admin roles without the command line (spec 11 §4.3). */
import { useEffect, useState, type FormEvent } from "react";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Modal, Select, Skeleton, Switch, TextField, useToast } from "../../../components/ui";
import { RoleRows, roleErrorMessage } from "../../../admin/RoleRows";
import type { Assignment, GrantableRole } from "../../../admin/types";
import { AdminNav } from "../AdminNav";
import { TeamSubnav } from "./TeamSubnav";
import "../candidates/admin.css";
import "../../../admin/admin-home.css";

const ORDER = ["system_admin", "news_reviewer", "pvc_officer", "membership_officer", "finance_officer", "moderator", "candidate"];
const GROUP_LABEL: Record<string, string> = {
  system_admin: "System administrators", news_reviewer: "News reviewers", pvc_officer: "PVC officers",
  membership_officer: "Membership officers", finance_officer: "Finance officers", moderator: "Moderators",
  candidate: "Candidate links",
};

export default function AdminTeamPage() {
  const api = useApi();
  const toast = useToast();
  const [showRevoked, setShowRevoked] = useState(false);
  const res = useRequest(`admin-team:${showRevoked}`, (signal) =>
    api<{ results: Assignment[]; grantable: GrantableRole[] }>(`/admin/team/${showRevoked ? "?revoked=1" : ""}`, { signal }));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    document.title = "Team | NDCConnect admin";
  }, []);

  const grantable = res.data?.grantable ?? [];
  const chosen = grantable.find((g) => g.role === role);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email.trim() || !role) return setFormError("Enter an email and choose a role.");
    setConfirm(true);
  };
  const grant = async () => {
    setBusy(true);
    try {
      const a = await api<Assignment>("/admin/team/", { method: "POST", body: { email: email.trim(), role, note } });
      toast.show({ tone: "success", message: `${a.user.full_name || a.user.email} is now a ${a.role_label.toLowerCase()}.` });
      setEmail(""); setRole(""); setNote("");
      res.retry();
    } catch (err) {
      setFormError(roleErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const rows = res.data?.results ?? [];
  return (
    <div className="adm-page">
      <AdminNav current="team" />
      <header className="adm-page__head">
        <div>
          <h1>Team</h1>
          <p className="ds-field__hint">Who can use the admin, and for what. Changes take effect straight away and are recorded in the audit log.</p>
        </div>
      </header>
      <TeamSubnav />
      <section className="adm-panel" aria-labelledby="grant-title">
        <h2 id="grant-title">Grant a role</h2>
        {formError && <Banner tone="error">{formError}</Banner>}
        <form className="adm-grant" onSubmit={submit} noValidate>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="They must have signed in once." />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}
            options={[{ value: "", label: "Choose a role" }, ...grantable.map((g) => ({ value: g.role, label: g.label }))]}
            hint={chosen ? `Can ${chosen.description}.` : undefined} />
          <TextField label="Note (optional)" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit">Grant role</Button>
        </form>
      </section>
      <Switch label="Show revoked" checked={showRevoked} onChange={(v) => setShowRevoked(v)} />
      {res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : (
        ORDER.filter((r) => rows.some((a) => a.role === r)).map((r) => (
          <section key={r} className="adm-role-group" aria-labelledby={`g-${r}`}>
            <h2 id={`g-${r}`}>{GROUP_LABEL[r]}</h2>
            <RoleRows rows={rows.filter((a) => a.role === r)} onChanged={res.retry} />
          </section>
        ))
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Grant this role?"
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Go back</Button><Button loading={busy} onClick={() => void grant()}>Grant role</Button></>}>
        <p>Give <strong>{email.trim()}</strong> the {chosen?.label} role? They’ll be able to {chosen?.description}.</p>
        {role === "system_admin" && (
          <Banner tone="warning">This gives full access to every admin area, including donations, membership and the audit log.</Banner>
        )}
      </Modal>
    </div>
  );
}
