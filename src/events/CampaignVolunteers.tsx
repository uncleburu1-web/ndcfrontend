/** A campaign's volunteering (spec 18 §9.3): opening settings, applications (short names), decide, contact (audited), updates. */
import { useEffect, useState } from "react";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { useRequest } from "../candidates/useRequest";
import { Banner, Button, Checkbox, Modal, Select, Skeleton, Switch, TextArea, useToast } from "../components/ui";
import { formatDate } from "../lib/format";
import type { VolunteerOpening, VolunteerRow } from "./types";
import { AVAILABILITY_WORDS, VOLUNTEER_ROLE_WORDS } from "./types";
import "./events.css";
import { t } from "../i18n";

export function CampaignVolunteers({ candidateId }: { candidateId: string }) {
  const api = useApi();
  const toast = useToast();
  const base = `/campaign/${candidateId}`;
  const op = useRequest(`vol-opening:${candidateId}`, (signal) => api<VolunteerOpening>(`${base}/volunteering/`, { signal }));
  const [status, setStatus] = useState("pending");
  const apps = useRequest(`vol-apps:${candidateId}:${status}`, (signal) =>
    api<{ results: VolunteerRow[]; counts: Record<string, number> }>(`${base}/volunteers/?status=${status}`, { signal }));
  const [o, setO] = useState<VolunteerOpening | null>(null);
  const [rows, setRows] = useState<VolunteerRow[]>([]);
  const [intro, setIntro] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [contact, setContact] = useState<{ full_name: string; phone_number: string | null } | null>(null);
  const [update, setUpdate] = useState("");
  const [updateRole, setUpdateRole] = useState("");
  useEffect(() => { if (op.data) { setO(op.data); setIntro(op.data.intro); setRoles(op.data.roles.map((r) => String(r.value))); } }, [op.data]);
  useEffect(() => { if (apps.data) setRows(apps.data.results); }, [apps.data]);
  const fail = (err: unknown) => toast.show({ tone: "error", message: err instanceof ApiError ? (Object.values(err.fields ?? {})[0]?.[0] ?? err.message) : t("events.that-didn-t-work") });
  const saveOpening = async (open: boolean) => {
    try {
      setO(await api<VolunteerOpening>(`${base}/volunteering/`, { method: "PATCH", body: { open, intro, roles } }));
      toast.show({ tone: "success", message: open ? t("events.volunteering-is-open") : t("events.volunteering-is-closed") });
    } catch (err) { fail(err); }
  };
  const decide = async (r: VolunteerRow, accept: boolean) => {
    const reason = accept ? "" : (window.prompt(t("events.reason-for-the-person-optional")) ?? "");
    try {
      const n = await api<VolunteerRow>(`${base}/volunteers/${r.id}/decide/`, { method: "POST", body: { accept, reason } });
      setRows((xs) => xs.filter((x) => x.id !== n.id || n.status === status).map((x) => (x.id === n.id ? n : x)));
      toast.show({ tone: "success", message: accept ? t("events.accepted") : t("events.declined") });
    } catch (err) { fail(err); }
  };
  const showContact = async (r: VolunteerRow) => {
    try { setContact(await api(`${base}/volunteers/${r.id}/contact/`)); } catch (err) { fail(err); }
  };
  const send = async () => {
    try {
      await api(`${base}/volunteers/updates/`, { method: "POST", body: { text: update, role: updateRole } });
      setUpdate("");
      toast.show({ tone: "success", message: t("events.update-sent-to-accepted-volunteers") });
    } catch (err) { fail(err); }
  };
  if (op.error) return <Banner tone="error">{op.error.message}</Banner>;
  if (!o) return <Skeleton width="100%" height={200} />;
  return (
    <div className="ev-form">
      <section className="ev-box" aria-labelledby="vo-h">
        <h3 id="vo-h">{t("events.volunteer-sign-up")}</h3>
        <TextArea label={t("events.what-volunteers-will-do")} rows={3} maxLength={1000} value={intro} onChange={(e) => setIntro(e.target.value)} />
        <fieldset><legend>{t("events.roles-you-need")}</legend>
          {o.all_roles.map((r) => <Checkbox key={String(r.value)} label={String(r.label)} checked={roles.includes(String(r.value))}
            onChange={() => setRoles((xs) => (xs.includes(String(r.value)) ? xs.filter((x) => x !== String(r.value)) : [...xs, String(r.value)]))} />)}
        </fieldset>
        <Switch label={t("events.taking-volunteers")} checked={o.open} onChange={(v: boolean) => void saveOpening(v)}
          hint={t("events.closing-it-ends-open-applications-and")} />
      </section>
      <section aria-labelledby="va-h">
        <h3 id="va-h">{t("events.applications")}</h3>
        <Select label={t("events.show")} value={status} onChange={(e) => setStatus(e.target.value)}
          options={["pending", "accepted", "declined", "withdrawn", "ended"].map((s) => ({ value: s,
            label: t("events.text", { toUpperCase: s[0].toUpperCase(), slice: s.slice(1), v: apps.data?.counts[s] ?? 0 }) }))} />
        {!apps.data ? <Skeleton width="100%" height={120} /> : rows.length === 0 ? <p>{t("events.none")}</p> : (
          <table className="ev-table">
            <thead><tr><th>{t("events.name")}</th><th>{t("events.area")}</th><th>{t("events.roles")}</th><th>{t("events.when")}</th><th>{t("events.note")}</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}<div className="ev-meta">{formatDate(r.created_at)}</div></td>
                <td>{r.state_label}{r.lga ? `, ${r.lga}` : ""}</td>
                <td>{r.roles.map((x) => VOLUNTEER_ROLE_WORDS[x] ?? x).join(", ")}</td>
                <td>{r.availability.map((x) => AVAILABILITY_WORDS[x] ?? x).join(", ")}</td>
                <td>{r.note}</td>
                <td className="ev-actions">
                  {r.status === "pending" && <><Button size="sm" onClick={() => void decide(r, true)}>{t("events.accept")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => void decide(r, false)}>{t("events.decline")}</Button></>}
                  {r.status === "accepted" && <Button size="sm" variant="secondary" onClick={() => void showContact(r)}>{t("events.show-contact")}</Button>}
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </section>
      <section className="ev-box" aria-labelledby="vup-h">
        <h3 id="vup-h">{t("events.send-an-update-to-accepted-volunteers")}</h3>
        <Select label={t("events.to")} value={updateRole} onChange={(e) => setUpdateRole(e.target.value)}
          options={[{ value: "", label: t("events.everyone-accepted") }, ...o.roles.map((r) => ({ value: String(r.value), label: String(r.label) }))]} />
        <TextArea label={t("events.update")} rows={3} maxLength={500} value={update} onChange={(e) => setUpdate(e.target.value)} hint={t("events.up-to-5-a-week")} />
        <div><Button disabled={update.trim().length < 10} onClick={() => void send()}>{t("events.send-update")}</Button></div>
      </section>
      <Modal open={Boolean(contact)} onClose={() => setContact(null)} title={t("events.contact-details")}
        footer={<Button onClick={() => setContact(null)}>{t("events.done")}</Button>}>
        <p><strong>{contact?.full_name}</strong></p>
        <p>{contact?.phone_number ?? t("events.they-didn-t-share-a-phone")}</p>
        <p className="ds-field__hint">{t("events.this-view-is-recorded-use-these")}</p>
      </Modal>
    </div>
  );
}
