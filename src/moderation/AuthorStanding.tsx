/**
 * What authors see about decisions on their own content (spec 13 §4.6, §8.1): removal notices with Appeal,
 * pause banners, warnings, appeal status and copyright counter-notices. Never who reported or who decided.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { useRequest } from "../candidates/useRequest";
import { Banner, Button, Modal, TextArea, useToast } from "../components/ui";
import { formatDate } from "../lib/format";
import type { AuthorView } from "./types";
import "./moderation.css";

export function useAuthorView() {
  const api = useApi();
  return useRequest("my-moderation", (signal) => api<AuthorView>("/me/moderation/", { signal }));
}

type Removal = AuthorView["removals"][number];

function AppealStatus({ appeal }: { appeal: Removal["appeal"] }) {
  if (!appeal) return null;
  return (
    <p className="mod-meta">
      Appeal: <strong>{appeal.status_label}</strong>
      {appeal.reason ? ` — ${appeal.reason}` : ""}
    </p>
  );
}

function CounterNotice({ removal, onSent }: { removal: Removal; onSent: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api("/me/counter-notices/", { method: "POST", body: { notice: removal.copyright_notice, text } });
      toast.show({ tone: "success", message: "Counter-notice sent. We’ll pass it to the rights owner." });
      setOpen(false);
      onSent();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t send it." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Send a counter-notice</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Copyright counter-notice"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void send()} disabled={!text.trim()} loading={busy} loadingLabel="Sending…">Send</Button></>}>
        <p>Explain why your content doesn’t infringe the copyright (for example, you made it or had permission). We send a copy to the rights owner; if they don’t answer in time, your content can be restored.</p>
        <TextArea label="Your counter-notice" required rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </>
  );
}

/** Shown on a removed news story or post in My news / My campaign. */
export function RemovalNotice({ removal, fallbackReason, onChange }: { removal?: Removal; fallbackReason: string; onChange: () => void }) {
  if (!removal) return <Banner tone="warning" title="Removed by NDCConnect">{fallbackReason}</Banner>;
  const title = removal.source === "copyright_notice" ? "Removed after a copyright notice"
    : removal.rule === "LEGAL" ? "Removed after a legal notice"
    : removal.rule ? <>Removed for breaking <Link to={`/rules#${removal.rule}`}>{removal.rule}: {removal.rule_title}</Link></>
    : "Removed by NDCConnect";
  return (
    <Banner tone="warning" title={title}>
      {removal.note_to_author && <p>{removal.note_to_author}</p>}
      <AppealStatus appeal={removal.appeal} />
      {(removal.can_appeal || removal.can_counter_notice) && (
        <div className="mod-row-actions">
          {removal.can_appeal && (
            <Button size="sm" href={`/appeals/new?case=${removal.case}`}>Appeal (until {formatDate(removal.appeal_until)})</Button>
          )}
          {removal.can_counter_notice && <CounterNotice removal={removal} onSent={onChange} />}
        </div>
      )}
    </Banner>
  );
}

/** Pause banner + warnings for community news authors (My news). */
export function StandingBanners({ view }: { view: AuthorView }) {
  const pause = view.restrictions.find((r) => r.active && r.kind === "news_pause");
  const warnings = view.restrictions.filter((r) => r.kind === "warning");
  return (
    <>
      {pause && (
        <Banner tone="warning" title={`You can submit community news again on ${formatDate(pause.ends_at ?? "")}`}>
          <p>
            Your community news is paused{pause.rule ? <> under <Link to={`/rules#${pause.rule}`}>{pause.rule}: {pause.rule_title}</Link></> : null}.
            {pause.reason ? ` ${pause.reason}` : ""}
          </p>
          <AppealStatus appeal={pause.appeal} />
          {pause.can_appeal && <div className="mod-row-actions"><Button size="sm" href={`/appeals/new?restriction=${pause.id}`}>Appeal</Button></div>}
        </Banner>
      )}
      {warnings.length > 0 && (
        <Banner tone="info" title={warnings.length === 1 ? "You have a warning on your account" : `You have ${warnings.length} warnings on your account`}>
          <ul>
            {warnings.map((w) => (
              <li key={w.id}>{formatDate(w.starts_at)}: {w.rule ? `${w.rule} ${w.rule_title}` : "community rules"}{w.reason ? ` — ${w.reason}` : ""}</li>
            ))}
          </ul>
          <p>Only you and NDCConnect’s moderators can see this.</p>
        </Banner>
      )}
    </>
  );
}
