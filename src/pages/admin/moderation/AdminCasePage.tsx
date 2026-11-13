/**
 * /admin/moderation/:id — one case (spec 13 §4.4): the item as readers see it, reports (reporter masked), author standing,
 * actions and history. The server re-checks the role table and rule 3 on every action.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Checkbox, EmptyState, Icon, Modal, RadioGroup, Skeleton, StatusBadge, Switch, TextArea, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { RuleSelect } from "../../../moderation/CaseLink";
import type { CaseDetail } from "../../../moderation/types";
import { EVENT_WORDS, dueWords } from "../../../moderation/words";
import { AdminNav } from "../AdminNav";
import { ModerationNav } from "./ModerationNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../moderation/moderation.css";
import { t } from "../../../i18n";

type Action = "keep" | "remove" | "restore" | "escalate" | "pause" | "warn" | null;

const BLOCKED: Record<string, string> = {
  get self_moderation() { return t("admin.you-can-t-act-on-this"); },
  get not_your_case() { return t("admin.someone-else-is-working-on-this"); },
  get permission_denied() { return t("admin.this-case-was-escalated-to-system"); },
};

export default function AdminCasePage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`case:${id}`, (signal) => api<CaseDetail>(`/admin/moderation/cases/${id}/`, { signal }));
  const [c, setC] = useState<CaseDetail | null>(null);
  const [modal, setModal] = useState<Action>(null);
  const [rule, setRule] = useState("");
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState("");
  const [warn, setWarn] = useState(false);
  const [parts, setParts] = useState<string[]>(["bio", "photo"]);  // spec 20 §5.1: what to remove from a public profile
  const [days, setDays] = useState("7");
  const [pauseScope, setPauseScope] = useState("community");
  const [busy, setBusy] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  useEffect(() => setC(res.data), [res.data]);
  useEffect(() => {
    document.title = t("admin.moderation-case-ndcconnect-admin");
  }, []);

  const open = (a: Action) => {
    setRule("");
    setNote("");
    setInternal("");
    setWarn(false);
    setDays("7");
    setModal(a);
  };
  const post = async (action: string, body: Record<string, unknown> = {}, done?: string) => {
    setBusy(action);
    try {
      setC(await api<CaseDetail>(`/admin/moderation/cases/${id}/${action}/`, { method: "POST", body }));
      setModal(null);
      if (done) toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? (BLOCKED[err.code] ?? err.message) : t("admin.that-didn-t-work") });
      res.retry();
    } finally {
      setBusy("");
    }
  };
  const reveal = async (reportId: string) => {
    try {
      const r = await api<{ reporter: { email: string; name: string } | null; contact_email: string }>(
        `/admin/moderation/cases/${id}/reports/${reportId}/reporter/`, { method: "POST" });
      setRevealed((x) => ({ ...x, [reportId]: r.reporter ? `${r.reporter.name || "—"} (${r.reporter.email || "deleted account"})` : r.contact_email || "Guest" }));
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-reveal-the-reporter") });
    }
  };

  if (res.error) {
    return <div className="adm-page"><AdminNav current="moderation" /><EmptyState title={t("admin.case-not-found")} action={<Button href="/admin/moderation">{t("admin.back-to-the-queue")}</Button>} /></div>;
  }
  if (!c) return <div className="adm-page"><AdminNav current="moderation" /><Skeleton width="100%" height={240} /></div>;

  const closed = c.status === "closed";
  const canAct = !c.blocked;
  const mine = c.assigned_to?.me;
  const item = c.item;
  const isCommunityNews = c.target_kind === "article" && !item?.official;
  const isCommunityItem = c.target_kind === "community_post" || c.target_kind === "community_comment";  // spec 17
  const isEvent = c.target_kind === "event";  // spec 18 §8: hideable like community items; the organiser is a campaign, not warned here
  const hideable = isCommunityItem || isEvent;
  const hasAuthor = (isCommunityNews || isCommunityItem) && !!item?.author;
  const removable = !closed && c.target_kind !== "candidate" && item?.public;
  const pauseActive = c.standing?.active_pause;

  return (
    <div className="adm-page">
      <AdminNav current="moderation" />
      <ModerationNav current={closed ? "closed" : c.status === "escalated" ? "escalated" : "open"} />
      <p className="adm-back"><Link to="/admin/moderation">{t("admin.queue")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{c.title || t("admin.untitled")}</h1>
          <div className="adm-status">
            <StatusBadge set="priority" status={c.priority} />
            <StatusBadge set="case" status={closed && c.decision ? c.decision : c.status} />
            <span>{c.kind_label}</span>
            {!closed && <span className={`mod-due${c.due?.overdue ? " mod-due--overdue" : ""}`}>{dueWords(c.due)}</span>}
            {c.legal_due_at && <span className="mod-meta">{t("admin.legal-deadline", { formatDate: formatDate(c.legal_due_at, { withTime: true }) })}</span>}
            {c.burst_flag && <span className="mod-flag">{t.rich("admin.burst-of-reports-look-carefully", { icon: <Icon name="alert" size={14} /> })}</span>}
          </div>
        </div>
        {canAct && !closed && (
          <div className="adm-actions">
            {!mine ? <Button variant="secondary" onClick={() => void post("claim", {}, t("admin.it-s-yours-for-4-hours"))} loading={busy === "claim"}>{t("admin.take-this-case")}</Button>
              : <Button variant="ghost" onClick={() => void post("release", {}, t("admin.released-to-the-pool"))} loading={busy === "release"}>{t("admin.release")}</Button>}
          </div>
        )}
      </header>

      {c.blocked && <Banner tone="info">{BLOCKED[c.blocked] ?? c.blocked_message}</Banner>}
      {isCommunityItem && item?.community && <p className="mod-meta">{t.rich("admin.in", { name: item.community.name, link: (chunks) => <Link to={`/communities/${item.community!.path}`}>{chunks}</Link>, v: item.status === "hidden" && item.hidden_at ? t("admin.hidden-since", { formatDate: formatDate(item.hidden_at, { withTime: true }) }) : "" })}</p>}
      {isEvent && item?.event && <p className="mod-meta">{t("admin.registered-by", { type_label: item.event.type_label, formatDate: formatDate(item.event.starts_at, { withTime: true }), venue: item.event.venue, v: item.event.venue_type_label ? ` (${item.event.venue_type_label})` : "", registered: item.event.registered, label: item.author?.label, v2: item.status === "hidden" && item.hidden_at ? t("admin.hidden-since", { formatDate: formatDate(item.hidden_at, { withTime: true }) }) : "" })}</p>}
      {hideable && item?.status === "hidden" && <Banner tone="warning" title={t("admin.hidden-while-deciding")}>
        {t("admin.remove-it-with-a-rule-restore")}</Banner>}
      {!c.blocked && c.assigned_to && !mine && !closed && <Banner tone="warning">{t("admin.has-this-case-open", { email: c.assigned_to.email })}</Banner>}
      {c.restorable && <Banner tone="info" title={t("admin.can-be-restored")}>{t("admin.the-rights-owner-didn-t-answer")}</Banner>}
      {c.decision === "removed" && <Banner tone="warning" title={t("admin.removed-2", { v: c.rule ? t("admin.under", { rule: c.rule }) : "" })}>
        {c.note_to_author || t("admin.no-note-to-the-author")}{c.decided_by ? t("admin.by-3", { decided_by: c.decided_by }) : ""}{c.decided_at ? ` · ${formatDate(c.decided_at, { withTime: true })}` : ""}
      </Banner>}

      {canAct && (
        <section className="adm-panel" aria-labelledby="actions-h">
          <h2 id="actions-h">{t("admin.decide")}</h2>
          <div className="adm-actions">
            {!closed && <Button variant="secondary" onClick={() => open("keep")}>{t("admin.keep")}</Button>}
            {removable && <Button variant="danger" onClick={() => open("remove")}>{t("admin.remove-2")}</Button>}
            {c.decision === "removed" && c.target_kind !== "candidate" && <Button variant="secondary" onClick={() => open("restore")}>{t("admin.restore")}</Button>}
            {hideable && !closed && item?.status === "published" && mine && (
              <Button variant="secondary" onClick={() => void post("hide", { note }, t("admin.hidden-while-you-decide-remove-restore"))}
                loading={busy === "hide"}>{t("admin.hide-while-deciding")}</Button>)}
            {hideable && item?.status === "hidden" && (
              <Button variant="secondary" onClick={() => void post("unhide", {}, t("admin.shown-again"))} loading={busy === "unhide"}>{t("admin.unhide")}</Button>)}
            {hasAuthor && <Button variant="secondary" onClick={() => open("warn")}>{t("admin.warn-the-author")}</Button>}
            {hasAuthor && !pauseActive && <Button variant="secondary" onClick={() => open("pause")}>
              {isCommunityItem ? t("admin.pause-community-posting") : t("admin.pause-community-news")}</Button>}
            {pauseActive && <Button variant="secondary" onClick={() => void post("lift-pause", { restriction: pauseActive.id }, t("admin.pause-lifted"))}>{t("admin.lift-the-pause")}</Button>}
            {!closed && c.status !== "escalated" && !c.is_system_admin && <Button variant="ghost" onClick={() => open("escalate")}>{t("admin.escalate")}</Button>}
            {!closed && c.status !== "escalated" && c.is_system_admin && <Button variant="ghost" onClick={() => open("escalate")}>{t("admin.mark-escalated")}</Button>}
          </div>
          {c.target_kind === "candidate" && !closed && (
            <p className="ds-field__hint">{t.rich("admin.candidate-profiles-aren-t-removed-correct", { link: (chunks) => <Link to={item?.admin_url ?? "/admin/candidates"}>{chunks}</Link> })}</p>
          )}
          {c.is_system_admin && (
            <Switch label={t("admin.legal-hold")} checked={c.legal_hold} onChange={(v) => void post("hold", { on: v }, v ? t("admin.legal-hold-on-nothing-about-this") : t("admin.legal-hold-off"))}
              hint={t("admin.stops-pruning-of-the-item-and")} />
          )}
        </section>
      )}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="item-h">
          <h2 id="item-h">{t("admin.the-item")}</h2>
          {!item ? <p className="ds-field__hint">{t("admin.this-item-no-longer-exists")}</p> : (
            <>
              {!item.public && <p>{t.rich("admin.hidden-from-the-public", { statusbadge: <StatusBadge set="case" status="removed" /> })}</p>}
              <h3>{item.title}</h3>
              <p className="mod-meta">
                {item.author?.label ?? (item.author ? `${item.author.name || "—"} (${item.author.email || "deleted account"})` : item.official ? t("admin.official-announcement") : "")}
              </p>
              {item.profile && (
                <p className="mod-meta">
                  {item.profile.photo_url ? <><img src={item.profile.photo_url} alt={t("admin.profile-photo")} width={96} height={96} className="mod-photo" />{" "}</> : t("admin.no-photo-shown")}
                  {item.profile.photo_removed_at ? t("admin.photo-removed") : ""}{item.profile.bio_removed_at ? t("admin.bio-removed") : ""}
                </p>
              )}
              <div className="mod-body">{item.body || (item.profile ? t("admin.no-bio") : "")}</div>
              <p className="mod-row-actions">
                {item.public && <Link to={item.public_url}>{t("admin.public-page")}</Link>}
                {item.admin_url && <Link to={item.admin_url}>{t("admin.admin-page")}</Link>}
              </p>
            </>
          )}
        </section>
        <section className="adm-panel" aria-labelledby="reports-h">
          <h2 id="reports-h">{t("admin.reports", { length: c.reports.length })}</h2>
          {c.reports.length === 0 ? <p className="ds-field__hint">{t("admin.no-reports-this-case-came-from")}</p> : (
            <ul className="adm-history">
              {c.reports.map((r) => (
                <li key={r.id}>
                  <strong>{r.reason_label}</strong> · {formatDate(r.created_at, { withTime: true })} · <StatusBadge set="report" status={r.status} />
                  <br /><span className="mod-meta">{revealed[r.id] ?? r.reporter_label}{r.contact_email && !revealed[r.id] ? ` · ${r.contact_email}` : ""}</span>
                  {r.details && <><br />{r.details}</>}
                  {c.is_system_admin && r.signed_in && !revealed[r.id] && (
                    <> <Button size="sm" variant="ghost" onClick={() => void reveal(r.id)}>{t("admin.show-reporter")}</Button></>
                  )}
                </li>
              ))}
            </ul>
          )}
          {c.standing && (
            <>
              <h2>{t("admin.author-standing-last-12-months")}</h2>
              <p>{t("admin.removals-warnings-pauses", { removals: c.standing.removals, warnings: c.standing.warnings, pauses: c.standing.pauses, v: c.standing.paused_until ? t("admin.paused-until", { formatDate: formatDate(c.standing.paused_until) }) : "" })}</p>
              {c.standing.suggestion && <Banner tone="info" title={t("admin.suggested-next-step")}>{t("admin.you-decide-nothing-happens-automatically", { suggestion: c.standing.suggestion })}</Banner>}
            </>
          )}
          {c.notices.length > 0 && (
            <>
              <h2>{t("admin.legal-notices")}</h2>
              <ul className="adm-history">
                {c.notices.map((n) => (
                  <li key={n.id}>{c.is_system_admin ? <Link to={`/admin/moderation/legal/${n.id}`}>{n.reference}</Link> : n.reference} · {n.kind_label} · {n.outcome}</li>
                ))}
              </ul>
            </>
          )}
          {c.appeals.length > 0 && (
            <>
              <h2>{t("admin.appeals")}</h2>
              <ul className="adm-history">
                {c.appeals.map((a) => (
                  <li key={a.id}><strong>{a.status_label}</strong> · {formatDate(a.created_at)} — {a.statement}{a.decision_reason ? t("admin.reason-2", { decision_reason: a.decision_reason }) : ""}</li>
                ))}
              </ul>
            </>
          )}
          <h2>{t("admin.history")}</h2>
          <ol className="adm-history">
            {c.history.map((e, i) => (
              <li key={i}><strong>{EVENT_WORDS[e.event] ?? e.event}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor ? ` · ${e.actor}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
          {c.internal_note && <p className="mod-meta">{t("admin.internal-note", { internal_note: c.internal_note })}</p>}
        </section>
      </div>

      <Modal open={modal === "keep"} onClose={() => setModal(null)} title={t("admin.keep-it-up")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button onClick={() => void post("keep", { note: internal }, t("admin.kept-reporters-are-told-the-content"))} loading={busy === "keep"}>{t("admin.keep-and-close")}</Button></>}>
        <p>{t("admin.the-case-closes-and-reports-are")}</p>
        <TextArea label={t("admin.internal-note-optional")} rows={2} maxLength={1000} value={internal} onChange={(e) => setInternal(e.target.value)} />
      </Modal>

      <Modal open={modal === "remove"} onClose={() => setModal(null)} title={t("admin.remove-this", { v: item?.kind_words ?? t("admin.item") })}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button variant="danger" disabled={!rule || (c.target_kind === "profile" && parts.length === 0)} loading={busy === "remove"}
            onClick={() => void post("remove", { rule, note_to_author: note, internal_note: internal, warn, ...(c.target_kind === "profile" ? { parts } : {}) },
              t("admin.removed-the-author-is-told-and"))}>
            {warn ? t("admin.remove-and-warn") : t("admin.remove-2")}
          </Button></>}>
        <p>{t("admin.it-s-hidden-from-the-public")}</p>
        {c.target_kind === "profile" && (
          <fieldset className="ds-fieldset">
            <legend className="ds-field__label">{t("admin.what-to-remove")}</legend>
            <p className="ds-field__hint">{t("admin.it-s-hidden-from-the-public-2")}</p>
            {["bio", "photo"].map((x) => (
              <Checkbox key={x} label={x === "bio" ? t("admin.the-bio") : t("admin.the-photo")} checked={parts.includes(x)}
                onChange={(e) => setParts((p) => (e.target.checked ? [...p, x] : p.filter((y) => y !== x)))} />
            ))}
          </fieldset>
        )}
        <RuleSelect value={rule} onChange={setRule} />
        <TextArea label={t("admin.note-to-the-author-optional")} hint={t("admin.they-see-this")} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <TextArea label={t("admin.internal-note-optional")} hint={t("admin.only-moderators-see-this")} rows={2} maxLength={1000} value={internal} onChange={(e) => setInternal(e.target.value)} />
        {isCommunityNews || c.target_kind === "post" ? (
          <Checkbox label={t("admin.also-add-a-warning-to-the")} checked={warn} onChange={(e) => setWarn(e.target.checked)} />
        ) : null}
      </Modal>

      <Modal open={modal === "restore"} onClose={() => setModal(null)} title={t("admin.restore-it")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button onClick={() => void post("restore", { note }, t("admin.restored-it-s-public-again"))} loading={busy === "restore"}>{t("admin.restore")}</Button></>}>
        <p>{t("admin.the-removal-notice-goes-and-the")}</p>
        <TextArea label={t("admin.note")} hint={t("admin.for-example-mistake-or-upheld-on")} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "escalate"} onClose={() => setModal(null)} title={t("admin.escalate-to-system-administrators")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button disabled={!note.trim()} onClick={() => void post("escalate", { note }, "Escalated.")} loading={busy === "escalate"}>{t("admin.escalate")}</Button></>}>
        <p>{t("admin.the-case-moves-to-the-escalated")}</p>
        <TextArea label={t("admin.why-2")} required rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "warn"} onClose={() => setModal(null)} title={t("admin.warn-the-author-2")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button disabled={!rule} onClick={() => void post("warn", { rule, reason: note }, t("admin.warning-added-the-author-is-told"))} loading={busy === "warn"}>{t("admin.add-warning")}</Button></>}>
        <p>{t("admin.a-warning-goes-on-the-author")}</p>
        <RuleSelect value={rule} onChange={setRule} />
        <TextArea label={t("admin.reason-shown-to-the-author")} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "pause"} onClose={() => setModal(null)}
        title={isCommunityItem ? t("admin.pause-this-author-s-community-posting") : t("admin.pause-this-author-s-community-news")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button variant="danger" disabled={!rule} onClick={() => void post("pause", { days: Number(days), rule, reason: note, ...(isCommunityItem ? { scope: pauseScope } : {}) },
            t("admin.paused-the-author-is-told-and"))}
            loading={busy === "pause"}>{t("admin.pause-for-day", { days, v: days === "1" ? "" : "s" })}</Button></>}>
        {isCommunityItem ? (
          <>
            <p>{t("admin.they-can-read-but-can-t")}</p>
            <RadioGroup legend={t("admin.how-long")} name="pause-days" required value={days} onChange={setDays}
              options={[{ value: "1", label: t("admin.1-day") }, { value: "7", label: t("admin.7-days") }, { value: "30", label: t("admin.30-days") }]} />
            <RadioGroup legend={t("admin.where-2")} name="pause-scope" required value={pauseScope} onChange={setPauseScope}
              options={[{ value: "community", label: t("admin.and-the-levels-below", { v: item?.community?.name ?? t("admin.this-community") }) },
                        { value: "all", label: t("admin.every-community-platform-wide-moderators-only") }]} />
          </>
        ) : (
          <>
            <p>{t("admin.they-can-t-submit-or-edit")}</p>
            <RadioGroup legend={t("admin.how-long")} name="pause-days" required value={days} onChange={setDays}
              options={[{ value: "7", label: t("admin.7-days") }, { value: "30", label: t("admin.30-days") }, { value: "90", label: t("admin.90-days") }]} />
          </>
        )}
        <RuleSelect value={rule} onChange={setRule} />
        <TextArea label={t("admin.reason-shown-to-the-author")} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
