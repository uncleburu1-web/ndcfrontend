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
import { t as tr } from "../../../i18n";

const ORDER = ["system_admin", "news_reviewer", "pvc_officer", "membership_officer", "finance_officer", "moderator", "candidate"];
const GROUP_LABEL: Record<string, string> = {
  get system_admin() { return tr("admin.system-administrators"); }, get news_reviewer() { return tr("admin.news-reviewers"); }, get pvc_officer() { return tr("admin.pvc-officers"); },
  get membership_officer() { return tr("admin.membership-officers"); }, get finance_officer() { return tr("admin.finance-officers"); }, get moderator() { return tr("admin.moderators"); },
  get candidate() { return tr("admin.candidate-links"); },
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
  // Spec 17 §8.2: a moderator for one national, state or LGA community (and everything below it)
  const [where, setWhere] = useState("");
  const [lga, setLga] = useState("");
  const [tops, setTops] = useState<{ id: string; name: string; level: string }[]>([]);
  const [lgas, setLgas] = useState<{ id: string; name: string }[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    document.title = tr("admin.team-ndcconnect-admin");
  }, []);

  useEffect(() => {
    if (role !== "moderator" || tops.length) return;
    api<{ id: string; name: string; level: string }[]>("/communities/", { anonymous: true }).then(setTops).catch(() => {});
  }, [api, role, tops.length]);
  useEffect(() => {
    setLga("");
    setLgas([]);
    const top = tops.find((t) => t.id === where);
    if (!top || top.level !== "state") return;
    api<{ id: string; name: string }[]>(`/communities/?parent=${where}`, { anonymous: true }).then(setLgas).catch(() => {});
  }, [api, where, tops]);
  const community = role === "moderator" ? lga || where : "";
  const grantable = res.data?.grantable ?? [];
  const chosen = grantable.find((g) => g.role === role);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email.trim() || !role) return setFormError(tr("admin.enter-an-email-and-choose-a"));
    setConfirm(true);
  };
  const grant = async () => {
    setBusy(true);
    try {
      const a = await api<Assignment>("/admin/team/", { method: "POST", body: { email: email.trim(), role, note, ...(community ? { community } : {}) } });
      toast.show({ tone: "success", message: tr("admin.is-now-a", { v: a.user.full_name || a.user.email, toLowerCase: a.role_label.toLowerCase() }) });
      setEmail(""); setRole(""); setNote(""); setWhere(""); setLga("");
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
          <h1>{tr("admin.team")}</h1>
          <p className="ds-field__hint">{tr("admin.who-can-use-the-admin-and")}</p>
        </div>
      </header>
      <TeamSubnav />
      <section className="adm-panel" aria-labelledby="grant-title">
        <h2 id="grant-title">{tr("admin.grant-a-role")}</h2>
        {formError && <Banner tone="error">{formError}</Banner>}
        <form className="adm-grant" onSubmit={submit} noValidate>
          <TextField label={tr("admin.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint={tr("admin.they-must-have-signed-in-once")} />
          <Select label={tr("admin.role")} value={role} onChange={(e) => setRole(e.target.value)}
            options={[{ value: "", label: tr("admin.choose-a-role") }, ...grantable.map((g) => ({ value: g.role, label: g.label }))]}
            hint={chosen ? tr("admin.can", { description: chosen.description }) : undefined} />
          {role === "moderator" && (
            <Select label={tr("admin.where")} value={where} onChange={(e) => setWhere(e.target.value)}
              options={[{ value: "", label: tr("admin.everywhere-every-community-news-and-posts") }, ...tops.map((t) => ({ value: t.id, label: t.name }))]}
              hint={tr("admin.a-community-moderator-covers-that-community")} />
          )}
          {role === "moderator" && lgas.length > 0 && (
            <Select label={tr("admin.lga-optional")} value={lga} onChange={(e) => setLga(e.target.value)}
              options={[{ value: "", label: tr("admin.the-whole-state") }, ...lgas.map((l) => ({ value: l.id, label: l.name }))]} />
          )}
          <TextField label={tr("admin.note-optional")} maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit">{tr("admin.grant-role")}</Button>
        </form>
      </section>
      <Switch label={tr("admin.show-revoked")} checked={showRevoked} onChange={(v) => setShowRevoked(v)} />
      {res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{tr("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
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
      <Modal open={confirm} onClose={() => setConfirm(false)} title={tr("admin.grant-this-role")}
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{tr("admin.go-back")}</Button><Button loading={busy} onClick={() => void grant()}>{tr("admin.grant-role")}</Button></>}>
        <p>{tr.rich("admin.give-the-role-they-ll-be", { email: email.trim(), strong: (chunks) => <strong>{chunks}</strong>, label: chosen?.label, description: chosen?.description })}</p>
        {role === "system_admin" && (
          <Banner tone="warning">{tr("admin.this-gives-full-access-to-every")}</Banner>
        )}
      </Modal>
    </div>
  );
}
