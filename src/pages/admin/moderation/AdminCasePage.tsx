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

type Action = "keep" | "remove" | "restore" | "escalate" | "pause" | "warn" | null;

const BLOCKED: Record<string, string> = {
  self_moderation: "You can’t act on this case: it’s about your own content, a candidate you’re linked to, or a report you filed.",
  not_your_case: "Someone else is working on this case.",
  permission_denied: "This case was escalated to system administrators.",
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
  const [days, setDays] = useState("7");
  const [pauseScope, setPauseScope] = useState("community");
  const [busy, setBusy] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  useEffect(() => setC(res.data), [res.data]);
  useEffect(() => {
    document.title = "Moderation case | NDCConnect admin";
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
      toast.show({ tone: "error", message: err instanceof ApiError ? (BLOCKED[err.code] ?? err.message) : "That didn’t work." });
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
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t reveal the reporter." });
    }
  };

  if (res.error) {
    return <div className="adm-page"><AdminNav current="moderation" /><EmptyState title="Case not found" action={<Button href="/admin/moderation">Back to the queue</Button>} /></div>;
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
      <p className="adm-back"><Link to="/admin/moderation">← Queue</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{c.title || "(untitled)"}</h1>
          <div className="adm-status">
            <StatusBadge set="priority" status={c.priority} />
            <StatusBadge set="case" status={closed && c.decision ? c.decision : c.status} />
            <span>{c.kind_label}</span>
            {!closed && <span className={`mod-due${c.due?.overdue ? " mod-due--overdue" : ""}`}>{dueWords(c.due)}</span>}
            {c.legal_due_at && <span className="mod-meta">Legal deadline {formatDate(c.legal_due_at, { withTime: true })}</span>}
            {c.burst_flag && <span className="mod-flag"><Icon name="alert" size={14} /> Burst of reports: look carefully</span>}
          </div>
        </div>
        {canAct && !closed && (
          <div className="adm-actions">
            {!mine ? <Button variant="secondary" onClick={() => void post("claim", {}, "It’s yours for 4 hours.")} loading={busy === "claim"}>Take this case</Button>
              : <Button variant="ghost" onClick={() => void post("release", {}, "Released to the pool.")} loading={busy === "release"}>Release</Button>}
          </div>
        )}
      </header>

      {c.blocked && <Banner tone="info">{BLOCKED[c.blocked] ?? c.blocked_message}</Banner>}
      {isCommunityItem && item?.community && <p className="mod-meta">In <Link to={`/communities/${item.community.path}`}>{item.community.name}</Link>
        {item.status === "hidden" && item.hidden_at ? ` · hidden since ${formatDate(item.hidden_at, { withTime: true })}` : ""}</p>}
      {isEvent && item?.event && <p className="mod-meta">{item.event.type_label} · {formatDate(item.event.starts_at, { withTime: true })} · {item.event.venue}
        {item.event.venue_type_label ? ` (${item.event.venue_type_label})` : ""} · {item.event.registered} registered · by {item.author?.label}
        {item.status === "hidden" && item.hidden_at ? ` · hidden since ${formatDate(item.hidden_at, { withTime: true })}` : ""}</p>}
      {hideable && item?.status === "hidden" && <Banner tone="warning" title="Hidden while deciding">
        Remove it with a rule, restore it, or keep it. After 48 hours the case becomes urgent; nothing reverts on its own.</Banner>}
      {!c.blocked && c.assigned_to && !mine && !closed && <Banner tone="warning">{c.assigned_to.email} has this case open.</Banner>}
      {c.restorable && <Banner tone="info" title="Can be restored">The rights owner didn’t answer the counter-notice in time.</Banner>}
      {c.decision === "removed" && <Banner tone="warning" title={`Removed${c.rule ? ` under ${c.rule}` : ""}`}>
        {c.note_to_author || "No note to the author."}{c.decided_by ? ` · by ${c.decided_by}` : ""}{c.decided_at ? ` · ${formatDate(c.decided_at, { withTime: true })}` : ""}
      </Banner>}

      {canAct && (
        <section className="adm-panel" aria-labelledby="actions-h">
          <h2 id="actions-h">Decide</h2>
          <div className="adm-actions">
            {!closed && <Button variant="secondary" onClick={() => open("keep")}>Keep</Button>}
            {removable && <Button variant="danger" onClick={() => open("remove")}>Remove</Button>}
            {c.decision === "removed" && c.target_kind !== "candidate" && <Button variant="secondary" onClick={() => open("restore")}>Restore</Button>}
            {hideable && !closed && item?.status === "published" && mine && (
              <Button variant="secondary" onClick={() => void post("hide", { note }, "Hidden while you decide. Remove, restore or keep it within 48 hours.")}
                loading={busy === "hide"}>Hide while deciding</Button>)}
            {hideable && item?.status === "hidden" && (
              <Button variant="secondary" onClick={() => void post("unhide", {}, "Shown again.")} loading={busy === "unhide"}>Unhide</Button>)}
            {hasAuthor && <Button variant="secondary" onClick={() => open("warn")}>Warn the author</Button>}
            {hasAuthor && !pauseActive && <Button variant="secondary" onClick={() => open("pause")}>
              {isCommunityItem ? "Pause community posting" : "Pause community news"}</Button>}
            {pauseActive && <Button variant="secondary" onClick={() => void post("lift-pause", { restriction: pauseActive.id }, "Pause lifted.")}>Lift the pause</Button>}
            {!closed && c.status !== "escalated" && !c.is_system_admin && <Button variant="ghost" onClick={() => open("escalate")}>Escalate</Button>}
            {!closed && c.status !== "escalated" && c.is_system_admin && <Button variant="ghost" onClick={() => open("escalate")}>Mark escalated</Button>}
          </div>
          {c.target_kind === "candidate" && !closed && (
            <p className="ds-field__hint">Candidate profiles aren’t removed: correct the profile in the <Link to={item?.admin_url ?? "/admin/candidates"}>candidate editor</Link>, then Keep to close the case.</p>
          )}
          {c.is_system_admin && (
            <Switch label="Legal hold" checked={c.legal_hold} onChange={(v) => void post("hold", { on: v }, v ? "Legal hold on: nothing about this item is pruned." : "Legal hold off.")}
              hint="Stops pruning of the item and its records until lifted." />
          )}
        </section>
      )}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="item-h">
          <h2 id="item-h">The item</h2>
          {!item ? <p className="ds-field__hint">This item no longer exists.</p> : (
            <>
              {!item.public && <p><StatusBadge set="case" status="removed" /> Hidden from the public</p>}
              <h3>{item.title}</h3>
              <p className="mod-meta">
                {item.author?.label ?? (item.author ? `${item.author.name || "—"} (${item.author.email || "deleted account"})` : item.official ? "Official announcement" : "")}
              </p>
              <div className="mod-body">{item.body}</div>
              <p className="mod-row-actions">
                {item.public && <Link to={item.public_url}>Public page</Link>}
                {item.admin_url && <Link to={item.admin_url}>Admin page</Link>}
              </p>
            </>
          )}
        </section>
        <section className="adm-panel" aria-labelledby="reports-h">
          <h2 id="reports-h">Reports ({c.reports.length})</h2>
          {c.reports.length === 0 ? <p className="ds-field__hint">No reports: this case came from a legal notice or was opened by NDCConnect.</p> : (
            <ul className="adm-history">
              {c.reports.map((r) => (
                <li key={r.id}>
                  <strong>{r.reason_label}</strong> · {formatDate(r.created_at, { withTime: true })} · <StatusBadge set="report" status={r.status} />
                  <br /><span className="mod-meta">{revealed[r.id] ?? r.reporter_label}{r.contact_email && !revealed[r.id] ? ` · ${r.contact_email}` : ""}</span>
                  {r.details && <><br />{r.details}</>}
                  {c.is_system_admin && r.signed_in && !revealed[r.id] && (
                    <> <Button size="sm" variant="ghost" onClick={() => void reveal(r.id)}>Show reporter</Button></>
                  )}
                </li>
              ))}
            </ul>
          )}
          {c.standing && (
            <>
              <h2>Author standing (last 12 months)</h2>
              <p>{c.standing.removals} removals · {c.standing.warnings} warnings · {c.standing.pauses} pauses
                {c.standing.paused_until ? ` · paused until ${formatDate(c.standing.paused_until)}` : ""}</p>
              {c.standing.suggestion && <Banner tone="info" title="Suggested next step">{c.standing.suggestion} You decide; nothing happens automatically.</Banner>}
            </>
          )}
          {c.notices.length > 0 && (
            <>
              <h2>Legal notices</h2>
              <ul className="adm-history">
                {c.notices.map((n) => (
                  <li key={n.id}>{c.is_system_admin ? <Link to={`/admin/moderation/legal/${n.id}`}>{n.reference}</Link> : n.reference} · {n.kind_label} · {n.outcome}</li>
                ))}
              </ul>
            </>
          )}
          {c.appeals.length > 0 && (
            <>
              <h2>Appeals</h2>
              <ul className="adm-history">
                {c.appeals.map((a) => (
                  <li key={a.id}><strong>{a.status_label}</strong> · {formatDate(a.created_at)} — {a.statement}{a.decision_reason ? ` · Reason: ${a.decision_reason}` : ""}</li>
                ))}
              </ul>
            </>
          )}
          <h2>History</h2>
          <ol className="adm-history">
            {c.history.map((e, i) => (
              <li key={i}><strong>{EVENT_WORDS[e.event] ?? e.event}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor ? ` · ${e.actor}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
          {c.internal_note && <p className="mod-meta">Internal note: {c.internal_note}</p>}
        </section>
      </div>

      <Modal open={modal === "keep"} onClose={() => setModal(null)} title="Keep it up?"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button onClick={() => void post("keep", { note: internal }, "Kept. Reporters are told the content stays up.")} loading={busy === "keep"}>Keep and close</Button></>}>
        <p>The case closes and reports are marked “No action”. Signed-in reporters are told the content stays up.</p>
        <TextArea label="Internal note (optional)" rows={2} maxLength={1000} value={internal} onChange={(e) => setInternal(e.target.value)} />
      </Modal>

      <Modal open={modal === "remove"} onClose={() => setModal(null)} title={`Remove this ${item?.kind_words ?? "item"}?`}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button variant="danger" disabled={!rule} loading={busy === "remove"}
            onClick={() => void post("remove", { rule, note_to_author: note, internal_note: internal, warn }, "Removed. The author is told and can appeal.")}>
            {warn ? "Remove and warn" : "Remove"}
          </Button></>}>
        <p>It’s hidden from the public, and its page shows “Removed by NDCConnect” with the rule. The author is notified with a way to appeal, and so are reporters.</p>
        <RuleSelect value={rule} onChange={setRule} />
        <TextArea label="Note to the author (optional)" hint="They see this." rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <TextArea label="Internal note (optional)" hint="Only moderators see this." rows={2} maxLength={1000} value={internal} onChange={(e) => setInternal(e.target.value)} />
        {isCommunityNews || c.target_kind === "post" ? (
          <Checkbox label="Also add a warning to the author’s record" checked={warn} onChange={(e) => setWarn(e.target.checked)} />
        ) : null}
      </Modal>

      <Modal open={modal === "restore"} onClose={() => setModal(null)} title="Restore it?"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button onClick={() => void post("restore", { note }, "Restored. It’s public again.")} loading={busy === "restore"}>Restore</Button></>}>
        <p>The removal notice goes, and the item returns to lists and search.</p>
        <TextArea label="Note" hint="For example “Mistake” or “Upheld on appeal”." rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "escalate"} onClose={() => setModal(null)} title="Escalate to system administrators?"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button disabled={!note.trim()} onClick={() => void post("escalate", { note }, "Escalated.")} loading={busy === "escalate"}>Escalate</Button></>}>
        <p>The case moves to the Escalated tab and stays open. Only system administrators can decide it.</p>
        <TextArea label="Why?" required rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "warn"} onClose={() => setModal(null)} title="Warn the author?"
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button disabled={!rule} onClick={() => void post("warn", { rule, reason: note }, "Warning added. The author is told.")} loading={busy === "warn"}>Add warning</Button></>}>
        <p>A warning goes on the author’s record (only they and moderators see it). They’re notified.</p>
        <RuleSelect value={rule} onChange={setRule} />
        <TextArea label="Reason (shown to the author)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "pause"} onClose={() => setModal(null)}
        title={isCommunityItem ? "Pause this author’s community posting?" : "Pause this author’s community news?"}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button variant="danger" disabled={!rule} onClick={() => void post("pause", { days: Number(days), rule, reason: note, ...(isCommunityItem ? { scope: pauseScope } : {}) },
            "Paused. The author is told and can appeal.")}
            loading={busy === "pause"}>Pause for {days} day{days === "1" ? "" : "s"}</Button></>}>
        {isCommunityItem ? (
          <>
            <p>They can read but can’t post, comment or like until the date. They’re notified and can appeal.</p>
            <RadioGroup legend="How long?" name="pause-days" required value={days} onChange={setDays}
              options={[{ value: "1", label: "1 day" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />
            <RadioGroup legend="Where?" name="pause-scope" required value={pauseScope} onChange={setPauseScope}
              options={[{ value: "community", label: `${item?.community?.name ?? "This community"} and the levels below` },
                        { value: "all", label: "Every community (platform-wide moderators only)" }]} />
          </>
        ) : (
          <>
            <p>They can’t submit or edit community news until the date. They’re notified and can appeal.</p>
            <RadioGroup legend="How long?" name="pause-days" required value={days} onChange={setDays}
              options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
          </>
        )}
        <RuleSelect value={rule} onChange={setRule} />
        <TextArea label="Reason (shown to the author)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
