/**
 * /account/privacy — Your data (spec 14 §4.4, §8.1): download, consents, corrections, other requests, history, delete.
 * Download and delete go through reverification (the API client opens Clerk's prompt and retries).
 */
import { useClerk } from "@clerk/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, CANCELLED_REVERIFICATION } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { Banner, Button, Icon, Modal, Select, Skeleton, TextArea, TextField, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { ConsentState, MyPrivacy, PrivacyRequest } from "../../privacy/types";
import { RequestStatusBadge } from "../../privacy/badges";
import "../../privacy/privacy.css";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DownloadSection({ onDone }: { onDone: () => void }) {
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
      toast.show({ tone: "success", message: "Your download is ready. Nothing is kept on our servers." });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : "Your download couldn’t be prepared. Try again later.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card" aria-labelledby="dl-h">
      <h2 id="dl-h">Download your data</h2>
      <p>A ZIP file with everything NDCConnect keeps about you, one file per part of the service, with a README explaining each. Your NIN and VIN are masked.</p>
      {error && <Banner tone="error">{error}</Banner>}
      <Button onClick={download} loading={busy} loadingLabel="Preparing…" icon={<Icon name="download" size={18} />}>Download my data</Button>
      <p className="privacy-meta">You’ll be asked to confirm it’s you. Up to 3 downloads a day.</p>
    </section>
  );
}

function ConsentsSection({ consents, onChanged }: { consents: ConsentState[]; onChanged: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConsentState | null>(null);
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const r = await api<{ effect: string }>(`/me/consents/${confirm.purpose}/`, { method: "DELETE" });
      toast.show({ tone: "success", message: r.effect || "Consent withdrawn." });
      setConfirm(null);
      onChanged();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t withdraw it. Try again." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card" aria-labelledby="consents-h">
      <h2 id="consents-h">Your consents</h2>
      <ul className="privacy-rows">
        {consents.map((c) => (
          <li key={c.purpose} className="privacy-row">
            <div>
              <strong>{c.label}</strong>
              <p className="privacy-meta">
                {c.given
                  ? `Given ${c.granted_at ? formatDate(c.granted_at) : ""} · version ${c.version}${c.method === "before_records" ? " · from before consent was recorded" : ""}`
                  : "Not given. We’ll ask when you use this."}
              </p>
            </div>
            {c.given && (
              <Button size="sm" variant="secondary" onClick={() => setConfirm(c)}>Withdraw</Button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={`Withdraw consent: ${confirm?.label ?? ""}`}
        footer={
          <div className="privacy-inline-actions">
            <Button variant="danger" onClick={withdraw} loading={busy}>Withdraw</Button>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>Keep it</Button>
          </div>
        }
      >
        <p>{confirm?.withdraw_effect}</p>
        <p className="privacy-meta">It takes effect at once. You can give consent again later.</p>
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
      setError("Choose what you’re asking for.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ reference: string; due_at: string }>("/me/privacy-requests/", { method: "POST", body: { kind, details } });
      toast.show({ tone: "success", message: `Request ${r.reference} sent. We’ll answer by ${formatDate(r.due_at)}.` });
      setKind("");
      setDetails("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t send it. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card" aria-labelledby="req-h">
      <h2 id="req-h">Other requests</h2>
      <p>Anything the download or the pages above don’t cover: a correction to approved records, erasing something specific, objecting to or restricting how we use your data. The Data Protection Officer answers within 30 days.</p>
      <form onSubmit={submit} noValidate className="privacy-form">
        {error && <Banner tone="error">{error}</Banner>}
        <Select label="What are you asking for?" required value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Choose one"
                options={kinds.filter((k) => k.value !== "withdraw_consent")} />
        <TextArea label="Details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000}
                  hint="What should we do, and which records it’s about. Don’t include your NIN or VIN." />
        <Button type="submit" loading={busy} loadingLabel="Sending…">Send request</Button>
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
      setError(err instanceof ApiError ? err.message : "Couldn’t send it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="privacy-form" noValidate>
      {error && <Banner tone="error">{error}</Banner>}
      <TextArea label="Your answer" required value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      <Button size="sm" type="submit" loading={busy}>Send answer</Button>
    </form>
  );
}

const EVENT_WORDS: Record<string, string> = {
  opened: "Request received", ask_info: "We asked for more information", info_given: "You answered", resumed: "We resumed work",
  reply: "Reply from the Data Protection Officer", done: "Done", refused: "Refused",
};

function HistorySection({ data, onChanged }: { data: MyPrivacy; onChanged: () => void }) {
  return (
    <section className="privacy-card" aria-labelledby="hist-h">
      <h2 id="hist-h">History</h2>
      {data.requests.length === 0 && data.downloads.length === 0 && data.consent_history.length === 0 && <p className="privacy-meta">Nothing yet.</p>}
      {data.requests.length > 0 && (
        <>
          <h3>Your requests</h3>
          <ul className="privacy-rows">
            {data.requests.map((r) => (
              <li key={r.id} className="privacy-request">
                <div className="privacy-row">
                  <strong>{r.reference} · {r.kind_label}</strong>
                  <RequestStatusBadge status={r.status} />
                </div>
                <p className="privacy-meta">Received {formatDate(r.received_at)} · {r.due_words}</p>
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
          <h3>Downloads</h3>
          <ul className="privacy-list">{data.downloads.map((d) => <li key={d}>{formatDate(d, { withTime: true })}</li>)}</ul>
        </>
      )}
      {data.consent_history.length > 0 && (
        <>
          <h3>Consent changes</h3>
          <ul className="privacy-list">
            {data.consent_history.map((c, i) => (
              <li key={i}>
                {c.label} v{c.version}: given {formatDate(c.granted_at)}
                {c.withdrawn_at ? `, withdrawn ${formatDate(c.withdrawn_at)}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function DeleteSection({ data }: { data: MyPrivacy }) {
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
      setError(err instanceof ApiError ? err.message : "Couldn’t delete your account. Nothing was removed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="privacy-card privacy-card--danger" id="delete" aria-labelledby="del-h" tabIndex={-1}>
      <h2 id="del-h">Delete my account</h2>
      <div className="privacy-two">
        <div>
          <h3>What goes</h3>
          <ul className="privacy-list">{data.delete.goes.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
        <div>
          <h3>What we keep, and why</h3>
          <ul className="privacy-list">{data.delete.stays.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      </div>
      <Button variant="danger" onClick={() => setOpen(true)}>Delete my account</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your account?"
        footer={
          <div className="privacy-inline-actions">
            <Button variant="danger" onClick={del} loading={busy} loadingLabel="Deleting…" disabled={typed.trim().toLowerCase() !== "delete"}>
              Delete my account
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          </div>
        }
      >
        <p>This can’t be undone. You’ll be signed out at once and asked to confirm it’s you first.</p>
        {error && <Banner tone="error">{error}</Banner>}
        <TextField label='Type "delete" to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
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
    document.title = "Your data | NDCConnect";
    load();
  }, [load]);
  useEffect(() => {
    if (data && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [data, hash]);

  return (
    <div className="privacy-page">
      <h1>Your data</h1>
      <p className="privacy-lead">See, download and control what NDCConnect keeps about you. <Link to="/privacy">Read the privacy notice</Link>.</p>
      {error && <Banner tone="error" title="We couldn’t load this page" action={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>Check your connection.</Banner>}
      {!data && !error && <Skeleton width="100%" height={320} />}
      {data && (
        <>
          {data.security_notices.length > 0 && (
            <section className="privacy-card privacy-card--notice" aria-labelledby="notice-h">
              <h2 id="notice-h"><Icon name="shield" size={20} /> Security notices</h2>
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
            <h2 id="fix-h">Correct your details</h2>
            <ul className="privacy-list">
              <li><Link to="/account">Name and phone number</Link></li>
              <li><Link to="/join">Membership details</Link> (before approval)</li>
              <li><Link to="/pvc">PVC details</Link></li>
            </ul>
            <p className="privacy-meta">Anything else, such as an approved membership’s register entry, goes through a request below.</p>
          </section>
          <RequestForm kinds={data.request_kinds} onCreated={load} />
          <HistorySection data={data} onChanged={load} />
          <DeleteSection data={data} />
          {me && !me.adult_confirmed && <p className="privacy-meta">NDCConnect is for people aged 18 and over.</p>}
        </>
      )}
    </div>
  );
}
