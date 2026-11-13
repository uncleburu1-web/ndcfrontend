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
import { t } from "../i18n";

export function useAuthorView() {
  const api = useApi();
  return useRequest("my-moderation", (signal) => api<AuthorView>("/me/moderation/", { signal }));
}

type Removal = AuthorView["removals"][number];

function AppealStatus({ appeal }: { appeal: Removal["appeal"] }) {
  if (!appeal) return null;
  return (
    <p className="mod-meta">
      {t.rich("moderation.appeal", { status_label: appeal.status_label, strong: (chunks) => <strong>{chunks}</strong>, v: appeal.reason ? ` — ${appeal.reason}` : "" })}
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
      toast.show({ tone: "success", message: t("moderation.counter-notice-sent-we-ll-pass") });
      setOpen(false);
      onSent();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("moderation.couldn-t-send-it") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t("moderation.send-a-counter-notice")}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("moderation.copyright-counter-notice")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("moderation.cancel")}</Button>
          <Button onClick={() => void send()} disabled={!text.trim()} loading={busy} loadingLabel={t("moderation.sending")}>{t("moderation.send")}</Button></>}>
        <p>{t("moderation.explain-why-your-content-doesn-t")}</p>
        <TextArea label={t("moderation.your-counter-notice")} required rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </>
  );
}

/** Shown on a removed news story or post in My news / My campaign. */
export function RemovalNotice({ removal, fallbackReason, onChange }: { removal?: Removal; fallbackReason: string; onChange: () => void }) {
  if (!removal) return <Banner tone="warning" title={t("moderation.removed-by-ndcconnect")}>{fallbackReason}</Banner>;
  const title = removal.source === "copyright_notice" ? "Removed after a copyright notice"
    : removal.rule === "LEGAL" ? "Removed after a legal notice"
    : removal.rule ? <>{t.rich("moderation.removed-for-breaking", { rule: removal.rule, rule_title: removal.rule_title, link: (chunks) => <Link to={`/rules#${removal.rule}`}>{chunks}</Link> })}</>
    : "Removed by NDCConnect";
  return (
    <Banner tone="warning" title={title}>
      {removal.note_to_author && <p>{removal.note_to_author}</p>}
      <AppealStatus appeal={removal.appeal} />
      {(removal.can_appeal || removal.can_counter_notice) && (
        <div className="mod-row-actions">
          {removal.can_appeal && (
            <Button size="sm" href={`/appeals/new?case=${removal.case}`}>{t("moderation.appeal-until", { formatDate: formatDate(removal.appeal_until) })}</Button>
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
        <Banner tone="warning" title={t("moderation.you-can-submit-community-news-again", { formatDate: formatDate(pause.ends_at ?? "") })}>
          <p>
            {t.rich("moderation.your-community-news-is-paused", { x1: pause.rule ? <> {t.rich("moderation.under-2", { rule: pause.rule, rule_title: pause.rule_title, link: (chunks) => <Link to={`/rules#${pause.rule}`}>{chunks}</Link> })}</> : null, v: pause.reason ? ` ${pause.reason}` : "" })}
          </p>
          <AppealStatus appeal={pause.appeal} />
          {pause.can_appeal && <div className="mod-row-actions"><Button size="sm" href={`/appeals/new?restriction=${pause.id}`}>{t("moderation.appeal-2")}</Button></div>}
        </Banner>
      )}
      {warnings.length > 0 && (
        <Banner tone="info" title={warnings.length === 1 ? t("moderation.you-have-a-warning-on-your") : t("moderation.you-have-warnings-on-your-account", { length: warnings.length })}>
          <ul>
            {warnings.map((w) => (
              <li key={w.id}>{formatDate(w.starts_at)}: {w.rule ? `${w.rule} ${w.rule_title}` : t("moderation.community-rules")}{w.reason ? ` — ${w.reason}` : ""}</li>
            ))}
          </ul>
          <p>{t("moderation.only-you-and-ndcconnect-s-moderators")}</p>
        </Banner>
      )}
    </>
  );
}
