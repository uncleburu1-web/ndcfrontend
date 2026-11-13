/**
 * /settings/privacy/data (was /account/privacy) — Your data (spec 14 §4.4, §8.1): download, consents, corrections, other requests, history, delete.
 * Download and delete go through reverification (the API client opens Clerk's prompt and retries).
 */
import { useClerk } from "@clerk/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, CANCELLED_REVERIFICATION } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { Banner, Button, Checkbox, Icon, Modal, Select, Skeleton, TextArea, TextField, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { ConsentState, MyPrivacy, PrivacyRequest } from "../../privacy/types";
import { RequestStatusBadge } from "../../privacy/badges";
import "../../privacy/privacy.css";
import { t } from "../../i18n";

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownloadSection({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await api<Blob>("/me/data-export/", { method: "POST", responseType: "blob" });
      saveBlob(blob, `ndcconnect-data-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.show({ tone: "success", message: t("privacy.your-download-is-ready-nothing-is") });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : t("privacy.your-download-couldn-t-be-prepared"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card" aria-labelledby="dl-h">
      <h2 id="dl-h">{t("privacy.download-your-data")}</h2>
      <p>{t("privacy.a-zip-file-with-everything-ndcconnect")}</p>
      {error && <Banner tone="error">{error}</Banner>}
      <Button onClick={download} loading={busy} loadingLabel={t("privacy.preparing")} icon={<Icon name="download" size={18} />}>{t("privacy.download-my-data")}</Button>
      <p className="privacy-meta">{t("privacy.you-ll-be-asked-to-confirm")}</p>
    </section>
  );
}

export function ConsentsSection({ consents, onChanged }: { consents: ConsentState[]; onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConsentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteContent, setDeleteContent] = useState(false);  // communities only (spec 17 §5.4)
  const withdraw = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const extra = confirm.purpose === "community_membership" && deleteContent ? "?delete_content=true" : "";
      const r = await api<{ effect: string }>(`/me/consents/${confirm.purpose}/${extra}`, { method: "DELETE" });
      toast.show({ tone: "success", message: r.effect || t("privacy.consent-withdrawn") });
      setConfirm(null);
      onChanged();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("privacy.couldn-t-withdraw-it-try-again") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card" aria-labelledby="consents-h">
      <h2 id="consents-h">{t("privacy.your-consents")}</h2>
      <ul className="privacy-rows">
        {consents.map((c) => (
          <li key={c.purpose} className="privacy-row">
            <div>
              <strong>{c.label}</strong>
              <p className="privacy-meta">
                {c.given ? t("privacy.given-version", { v: c.granted_at ? formatDate(c.granted_at) : "", version: c.version, v2: c.method === "before_records" ? t("privacy.from-before-consent-was-recorded") : "" }) : t("privacy.not-given-we-ll-ask-when")}
              </p>
            </div>
            {c.given && (
              <Button size="sm" variant="secondary" onClick={() => setConfirm(c)}>{t("privacy.withdraw")}</Button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t("privacy.withdraw-consent", { v: confirm?.label ?? "" })}
        footer={
          <div className="privacy-inline-actions">
            <Button variant="danger" onClick={withdraw} loading={busy}>{t("privacy.withdraw")}</Button>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>{t("privacy.keep-it")}</Button>
          </div>
        }
      >
        <p>{confirm?.withdraw_effect}</p>
        {confirm?.purpose === "community_membership" && (
          <Checkbox label={t("privacy.also-delete-my-posts-comments-and")} checked={deleteContent} onChange={(e) => setDeleteContent(e.target.checked)}
            hint={t("privacy.removed-posts-are-kept-until-their")} />
        )}
        <p className="privacy-meta">{t("privacy.it-takes-effect-at-once-you")}</p>
      </Modal>
    </section>
  );
}

function RequestForm({ kinds, onCreated }: { kinds: { value: string; label: string }[]; onCreated: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [kind, setKind] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!kind) {
      setError(t("privacy.choose-what-you-re-asking-for"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ reference: string; due_at: string }>("/me/privacy-requests/", { method: "POST", body: { kind, details } });
      toast.show({ tone: "success", message: t("privacy.request-sent-we-ll-answer-by", { reference: r.reference, formatDate: formatDate(r.due_at) }) });
      setKind("");
      setDetails("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("privacy.couldn-t-send-it-try-again"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card" aria-labelledby="req-h">
      <h2 id="req-h">{t("privacy.other-requests")}</h2>
      <p>{t("privacy.anything-the-download-or-the-pages")}</p>
      <form onSubmit={submit} noValidate className="privacy-form">
        {error && <Banner tone="error">{error}</Banner>}
        <Select label={t("privacy.what-are-you-asking-for")} required value={kind} onChange={(e) => setKind(e.target.value)} placeholder={t("privacy.choose-one")}
                options={kinds.filter((k) => k.value !== "withdraw_consent")} />
        <TextArea label={t("privacy.details")} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000}
                  hint={t("privacy.what-should-we-do-and-which")} />
        <Button type="submit" loading={busy} loadingLabel={t("privacy.sending")}>{t("privacy.send-request")}</Button>
      </form>
    </section>
  );
}

function AnswerForm({ req, onDone }: { req: PrivacyRequest; onDone: () => void }) {
  const api = useApi();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/me/privacy-requests/${req.id}/answer/`, { method: "POST", body: { text } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("privacy.couldn-t-send-it"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="privacy-form" noValidate>
      {error && <Banner tone="error">{error}</Banner>}
      <TextArea label={t("privacy.your-answer")} required value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      <Button size="sm" type="submit" loading={busy}>{t("privacy.send-answer")}</Button>
    </form>
  );
}

const EVENT_WORDS: Record<string, string> = {
  get opened() { return t("privacy.request-received"); }, get ask_info() { return t("privacy.we-asked-for-more-information"); }, get info_given() { return t("privacy.you-answered"); }, get resumed() { return t("privacy.we-resumed-work"); },
  get reply() { return t("privacy.reply-from-the-data-protection-officer"); }, get done() { return t("privacy.done"); }, get refused() { return t("privacy.refused"); },
};

function HistorySection({ data, onChanged }: { data: MyPrivacy; onChanged: () => void }) {
  return (
    <section className="privacy-card" aria-labelledby="hist-h">
      <h2 id="hist-h">{t("privacy.history")}</h2>
      {data.requests.length === 0 && data.downloads.length === 0 && data.consent_history.length === 0 && <p className="privacy-meta">{t("privacy.nothing-yet")}</p>}
      {data.requests.length > 0 && (
        <>
          <h3>{t("privacy.your-requests")}</h3>
          <ul className="privacy-rows">
            {data.requests.map((r) => (
              <li key={r.id} className="privacy-request">
                <div className="privacy-row">
                  <strong>{r.reference} · {r.kind_label}</strong>
                  <RequestStatusBadge status={r.status} />
                </div>
                <p className="privacy-meta">{t("privacy.received", { formatDate: formatDate(r.received_at), due_words: r.due_words })}</p>
                <ol className="privacy-events">
                  {r.events.map((e, i) => (
                    <li key={i}>
                      <span className="privacy-meta">{formatDate(e.at, { withTime: true })}</span> {EVENT_WORDS[e.event] ?? e.event}
                      {e.note && <p className="privacy-note">{e.note}</p>}
                    </li>
                  ))}
                </ol>
                {r.status === "waiting" && <AnswerForm req={r} onDone={onChanged} />}
              </li>
            ))}
          </ul>
        </>
      )}
      {data.downloads.length > 0 && (
        <>
          <h3>{t("privacy.downloads")}</h3>
          <ul className="privacy-list">{data.downloads.map((d) => <li key={d}>{formatDate(d, { withTime: true })}</li>)}</ul>
        </>
      )}
      {data.consent_history.length > 0 && (
        <>
          <h3>{t("privacy.consent-changes")}</h3>
          <ul className="privacy-list">
            {data.consent_history.map((c, i) => (
              <li key={i}>
                {t("privacy.v-given", { label: c.label, version: c.version, formatDate: formatDate(c.granted_at), v: c.withdrawn_at ? t("privacy.withdrawn", { formatDate: formatDate(c.withdrawn_at) }) : "" })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function DeleteSection({ data }: { data: MyPrivacy | null }) {
  const api = useApi();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const del = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/me/delete/", { method: "POST", body: { confirm: typed } });
      setOpen(false);
      await signOut({ redirectUrl: "/account-deleted" });
      navigate("/account-deleted", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : t("privacy.couldn-t-delete-your-account-nothing"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card privacy-card--danger" id="delete" aria-labelledby="del-h" tabIndex={-1}>
      <h2 id="del-h">{t("privacy.delete-my-account")}</h2>
      {data ? (
        <div className="privacy-two">
          <div>
            <h3>{t("privacy.what-goes")}</h3>
            <ul className="privacy-list">{data.delete.goes.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
          <div>
            <h3>{t("privacy.what-we-keep-and-why")}</h3>
            <ul className="privacy-list">{data.delete.stays.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        </div>
      ) : (
        <p>{t.rich("privacy.your-account-and-personal-details-are", { link: (chunks) => <Link to="/privacy">{chunks}</Link> })}</p>
      )}
      <Button variant="danger" onClick={() => setOpen(true)}>{t("privacy.delete-my-account")}</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("privacy.delete-your-account")}
        footer={
          <div className="privacy-inline-actions">
            <Button variant="danger" onClick={del} loading={busy} loadingLabel={t("privacy.deleting")} disabled={typed.trim().toLowerCase() !== "delete"}>
              {t("privacy.delete-my-account")}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t("privacy.cancel")}</Button>
          </div>
        }
      >
        <p>{t("privacy.this-can-t-be-undone-you")}</p>
        {error && <Banner tone="error">{error}</Banner>}
        <TextField label={t("privacy.type-delete-to-confirm")} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Modal>
    </section>
  );
}

export default function YourDataPage() {
  const api = useApi();
  const { me } = useMe();
  const { hash } = useLocation();
  const [data, setData] = useState<MyPrivacy | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    api<MyPrivacy>("/me/privacy/").then((d) => { setData(d); setError(false); }).catch(() => setError(true));
  }, [api]);
  useEffect(() => {
    document.title = t("privacy.your-data-ndcconnect");
    load();
  }, [load]);
  useEffect(() => {
    if (data && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [data, hash]);

  return (
    <div className="privacy-page">
      <h1>{t("privacy.your-data")}</h1>
      <p className="privacy-lead">{t.rich("privacy.see-download-and-control-what-ndcconnect", { link: (chunks) => <Link to="/privacy">{chunks}</Link> })}</p>
      {error && <Banner tone="error" title={t("privacy.we-couldn-t-load-this-page")} action={<Button size="sm" variant="secondary" onClick={load}>{t("privacy.try-again")}</Button>}>{t("privacy.check-your-connection")}</Banner>}
      {!data && !error && <Skeleton width="100%" height={320} />}
      {data && (
        <>
          {data.security_notices.length > 0 && (
            <section className="privacy-card privacy-card--notice" aria-labelledby="notice-h">
              <h2 id="notice-h">{t.rich("privacy.security-notices", { icon: <Icon name="shield" size={20} /> })}</h2>
              {data.security_notices.map((n) => (
                <div key={n.id}>
                  <p className="privacy-meta">{formatDate(n.sent_at, { withTime: true })} · {n.reference}</p>
                  <p>{n.text}</p>
                </div>
              ))}
            </section>
          )}
          <DownloadSection onDone={load} />
          <ConsentsSection consents={data.consents} onChanged={load} />
          <section className="privacy-card" aria-labelledby="fix-h">
            <h2 id="fix-h">{t("privacy.correct-your-details")}</h2>
            <ul className="privacy-list">
              <li><Link to="/settings/account">{t("privacy.name-and-phone-number")}</Link></li>
              <li>{t.rich("privacy.membership-details-before-approval", { link: (chunks) => <Link to="/join">{chunks}</Link> })}</li>
              <li><Link to="/pvc">{t("privacy.pvc-details")}</Link></li>
            </ul>
            <p className="privacy-meta">{t("privacy.anything-else-such-as-an-approved")}</p>
          </section>
          <RequestForm kinds={data.request_kinds} onCreated={load} />
          <HistorySection data={data} onChanged={load} />
          <DeleteSection data={data} />
          {me && !me.adult_confirmed && <p className="privacy-meta">{t("privacy.ndcconnect-is-for-people-aged-18")}</p>}
        </>
      )}
    </div>
  );
}
