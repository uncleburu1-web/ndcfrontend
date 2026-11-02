/**
 * /admin/candidates/new and /admin/candidates/:id — create/edit, workflow actions,
 * photo and linked accounts (spec 03 §6, §8.3). The backend enforces every rule;
 * this page explains each effect before it happens.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import type { AdminCandidate, LinkedAccount } from "../../../candidates/types";
import { useRequest } from "../../../candidates/useRequest";
import { Avatar, Banner, Button, Checkbox, EmptyState, Modal, Select, Skeleton, StatusBadge, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { moderationError } from "../../../posts/moderation";
import { REMOVE_REASONS, type AdminPost } from "../../../posts/types";
import { CandidateForm, IDENTITY_FIELDS, toFormValues, toPayload, type CandidateFormValues } from "./CandidateForm";
import "./admin.css";

type ActionName = "verify" | "unverify" | "publish" | "unpublish" | "archive" | "restore";

const asApiError = (err: unknown) => (err instanceof ApiError ? err : new ApiError({}));

/* --------------------------------------------------------------- actions */
interface ActionSpec {
  label: string;
  title: (name: string) => string;
  body: (name: string) => ReactNode;
  input?: { field: "notes" | "reason"; label: string; hint?: string };
  variant?: "primary" | "secondary" | "danger";
}

const ACTIONS: Record<ActionName, ActionSpec> = {
  verify: {
    label: "Verify",
    title: (n) => `Verify ${n}?`,
    body: () => "Confirm you have checked this candidate's details against supporting information. Verification is required before publishing.",
    input: { field: "notes", label: "What did you check?", hint: "Internal note, never shown publicly. For example: matched the INEC nomination list." },
  },
  unverify: { label: "Remove verification", variant: "secondary", title: (n) => `Remove verification from ${n}?`, body: () => "They can't be published again until someone verifies them." },
  publish: { label: "Publish", title: (n) => `Publish ${n}?`, body: (n) => `${n} will appear on the public Candidates page straight away.` },
  unpublish: {
    label: "Unpublish",
    variant: "secondary",
    title: (n) => `Unpublish ${n}?`,
    body: (n) => `${n} will disappear from the public Candidates page. Their profile link will show “not found”.`,
    input: { field: "reason", label: "Reason", hint: "Recorded in the audit log." },
  },
  archive: {
    label: "Archive",
    variant: "danger",
    title: (n) => `Archive ${n}?`,
    body: (n) => `${n} will be hidden everywhere public, and every linked account will lose access to this candidate. History is kept, and you can restore later.`,
    input: { field: "reason", label: "Reason", hint: "Recorded in the audit log." },
  },
  restore: { label: "Restore", variant: "secondary", title: (n) => `Restore ${n}?`, body: () => "They go back to draft, unverified. Linked accounts are not restored; link them again if needed." },
};

function availableActions(c: AdminCandidate): ActionName[] {
  switch (c.status) {
    case "draft":
    case "unpublished":
      return c.is_verified ? ["publish", "unverify", "archive"] : ["verify", "archive"];
    case "published":
      return ["unpublish", "archive"];
    case "archived":
      return ["restore"];
  }
}

function ActionBar({ candidate, onDone }: { candidate: AdminCandidate; onDone: (c: AdminCandidate) => void }) {
  const api = useApi();
  const toast = useToast();
  const [open, setOpen] = useState<ActionName | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const spec = open ? ACTIONS[open] : null;

  const run = async () => {
    if (!open || !spec) return;
    setBusy(true);
    setError(null);
    try {
      const body = spec.input ? { [spec.input.field]: text } : {};
      const updated = await api<AdminCandidate>(`/admin/candidates/${candidate.id}/${open}/`, { method: "POST", body });
      toast.show({ tone: "success", message: `${spec.label}: done for ${updated.full_name}.` });
      setOpen(null);
      setText("");
      onDone(updated);
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="adm-actions">
        {availableActions(candidate).map((a) => (
          <Button key={a} variant={ACTIONS[a].variant ?? "primary"} onClick={() => { setOpen(a); setText(""); setError(null); }}>
            {ACTIONS[a].label}
          </Button>
        ))}
      </div>
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={spec?.title(candidate.full_name) ?? ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
            <Button variant={spec?.variant === "danger" ? "danger" : "primary"} loading={busy} loadingLabel="Working…" onClick={run}>
              {spec?.label}
            </Button>
          </>
        }
      >
        <p>{spec?.body(candidate.full_name)}</p>
        {error && error.code !== "validation_error" && <Banner tone="error">{error.message}</Banner>}
        {spec?.input && (
          <TextArea label={spec.input.label} hint={spec.input.hint} required rows={3} value={text} onChange={(e) => setText(e.target.value)}
            error={error?.fields?.[spec.input.field]?.[0]} />
        )}
      </Modal>
    </>
  );
}

/* ----------------------------------------------------------------- posts */
/** The candidate's own posts (spec 09 §4.4). Admins can remove or restore, never edit. */
function PostsPanel({ candidate }: { candidate: AdminCandidate }) {
  const api = useApi();
  const toast = useToast();
  const { data, error, loading, retry } = useRequest(`admin-candidate-posts:${candidate.id}`, (signal) =>
    api<{ results: AdminPost[] }>(`/admin/candidates/${candidate.id}/posts/`, { signal })
  );
  const list = Array.isArray(data?.results) ? data.results : [];
  const [removing, setRemoving] = useState<AdminPost | null>(null);
  const [reason, setReason] = useState(REMOVE_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const act = async (post: AdminPost, action: "remove" | "restore") => {
    setBusy(true);
    try {
      await api(`/admin/posts/${post.id}/${action}/`, { method: "POST", body: action === "remove" ? { reason } : undefined });
      toast.show({ tone: "success", message: action === "remove" ? "Post removed." : "Post restored." });
      setRemoving(null);
      retry();
    } catch (err) {
      toast.show({ tone: "error", message: moderationError(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="adm-panel" aria-labelledby="posts-title">
      <h2 id="posts-title">Posts</h2>
      {error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>{error.message}</Banner>
      ) : loading && !data ? (
        <Skeleton height={60} />
      ) : list.length ? (
        <ul className="adm-history">
          {list.slice(0, 10).map((p) => (
            <li key={p.id}>
              <a href={`/admin/posts/${p.id}`}>{p.title}</a> · <StatusBadge set="post" status={p.status} /> · {formatDate(p.published_at)}
              {p.open_reports ? ` · ${p.open_reports} open reports` : ""}
              {p.status === "published" && <> <Button size="sm" variant="ghost" onClick={() => { setReason(REMOVE_REASONS[0]); setRemoving(p); }}>Remove</Button></>}
              {p.status === "removed" && <> <Button size="sm" variant="ghost" loading={busy} onClick={() => void act(p, "restore")}>Restore</Button></>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-field__hint">No posts yet. Linked accounts publish from My campaign.</p>
      )}
      {list.length > 10 && <p><a href={`/admin/posts?candidate=${candidate.id}`}>See all {list.length} posts</a></p>}
      <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} title="Remove this post?"
        footer={<><Button variant="secondary" onClick={() => setRemoving(null)}>Go back</Button>
          <Button variant="danger" loading={busy} onClick={() => removing && void act(removing, "remove")}>Remove post</Button></>}>
        <p>The campaign sees this reason. For a custom reason, open the post.</p>
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}
          options={REMOVE_REASONS.filter((r) => r !== "Other").map((r) => ({ value: r, label: r }))} />
      </Modal>
    </section>
  );
}

/* ----------------------------------------------------------------- photo */
/** Counts only — there is no list of who follows a candidate, for anyone (spec 04 §7.4, §10). */
function FollowersPanel({ followers }: { followers: { total: number; notify_on: number } }) {
  const n = new Intl.NumberFormat("en-NG");
  return (
    <section className="adm-panel adm-followers" aria-labelledby="followers-title">
      <h2 id="followers-title">Followers</h2>
      <p className="adm-followers__line">
        <strong>{n.format(followers.total)}</strong> {followers.total === 1 ? "follower" : "followers"} ·{" "}
        {n.format(followers.notify_on)} with notifications on
      </p>
      <p className="ds-field__hint">Counts only. Who follows a candidate is private and isn’t shown to anyone.</p>
    </section>
  );
}

function PhotoPanel({ candidate, onDone }: { candidate: AdminCandidate; onDone: (c: AdminCandidate) => void }) {
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = (f: File | null) => {
    setError(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("photo", file);
    form.append("rights_confirmed", rights ? "true" : "false");
    setBusy(true);
    setError(null);
    try {
      onDone(await api<AdminCandidate>(`/admin/candidates/${candidate.id}/photo/`, { method: "PUT", body: form }));
      choose(null);
      setRights(false);
      if (input.current) input.current.value = "";
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      onDone(await api<AdminCandidate>(`/admin/candidates/${candidate.id}/photo/`, { method: "DELETE" }));
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-panel" aria-labelledby="photo-title">
      <h2 id="photo-title">Photo</h2>
      <div className="adm-photo">
        <Avatar name={candidate.full_name} src={preview ?? candidate.photo?.url_200} size="lg" />
        <p className="ds-field__hint">JPEG, PNG or WebP, up to 5 MB, at least 400 × 400 pixels. We crop it square, remove hidden location data and resize it for mobile.</p>
      </div>
      <form onSubmit={upload} noValidate>
        <div className="ds-field">
          <label className="ds-field__label" htmlFor="photo-input">Choose a photo</label>
          <input id="photo-input" ref={input} className="adm-file" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => choose(e.target.files?.[0] ?? null)} aria-describedby={error ? "photo-error" : undefined} />
          {(error?.fields?.photo?.[0] || (error && error.code !== "validation_error")) && (
            <p id="photo-error" className="ds-field__error">{error.fields?.photo?.[0] ?? error.message}</p>
          )}
        </div>
        <Checkbox label="NDCConnect may publish this photo" hint="Confirm the campaign agreed to its use." checked={rights}
          onChange={(e) => setRights(e.target.checked)} error={error?.fields?.rights_confirmed?.[0]} />
        <div className="adm-actions">
          <Button type="submit" disabled={!file} loading={busy} loadingLabel="Uploading…">Upload photo</Button>
          {candidate.photo && <Button variant="ghost" onClick={remove} disabled={busy}>Remove photo</Button>}
        </div>
      </form>
    </section>
  );
}

/* --------------------------------------------------------------- accounts */
function AccountsPanel({ candidate }: { candidate: AdminCandidate }) {
  const api = useApi();
  const toast = useToast();
  const { data, error, loading, retry } = useRequest(`accounts:${candidate.id}:${candidate.status}`, (signal) =>
    api<LinkedAccount[]>(`/admin/candidates/${candidate.id}/accounts/`, { signal })
  );
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState<ApiError | null>(null);
  const [unlinking, setUnlinking] = useState<LinkedAccount | null>(null);

  const link = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLinkError(null);
    try {
      await api(`/admin/candidates/${candidate.id}/accounts/`, { method: "POST", body: { email } });
      toast.show({ tone: "success", message: `Linked ${email} to ${candidate.full_name}.` });
      setEmail("");
      retry();
    } catch (err) {
      setLinkError(asApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!unlinking) return;
    setBusy(true);
    try {
      await api(`/admin/candidates/${candidate.id}/accounts/${unlinking.user_id}/`, { method: "DELETE" });
      toast.show({ tone: "success", message: `Unlinked ${unlinking.email}.` });
      setUnlinking(null);
      retry();
    } catch (err) {
      toast.show({ tone: "error", message: asApiError(err).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-panel" aria-labelledby="accounts-title">
      <h2 id="accounts-title">Linked accounts</h2>
      <p className="ds-field__hint">People who will be able to post for this candidate once candidate posts are available. Only admins see this list.</p>
      {error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>{error.message}</Banner>
      ) : loading && !data ? (
        <Skeleton height={36} />
      ) : data && data.length ? (
        <ul className="adm-accounts">
          {data.map((a) => (
            <li key={a.user_id}>
              <span><strong>{a.full_name || a.email}</strong><br /><span className="ds-field__hint">{a.email} · linked {formatDate(a.linked_at)}</span></span>
              <Button size="sm" variant="ghost" onClick={() => setUnlinking(a)}>Unlink<span className="visually-hidden"> {a.email}</span></Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-field__hint">No accounts linked yet.</p>
      )}
      {candidate.status !== "archived" && (
        <form onSubmit={link} noValidate className="adm-link-form">
          <TextField label="Link an account by email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            hint="They must have signed up to NDCConnect first." error={linkError?.fields?.email?.[0] ?? (linkError && linkError.code !== "validation_error" ? linkError.message : undefined)} />
          <Button type="submit" variant="secondary" loading={busy} loadingLabel="Linking…" disabled={!email.trim()}>Link account</Button>
        </form>
      )}
      <Modal open={Boolean(unlinking)} onClose={() => setUnlinking(null)} title={`Unlink ${unlinking?.email ?? ""}?`}
        footer={<><Button variant="secondary" onClick={() => setUnlinking(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={unlink}>Unlink account</Button></>}>
        <p>They will no longer be able to act for {candidate.full_name}.</p>
      </Modal>
    </section>
  );
}

/* ------------------------------------------------------------------ page */
export default function AdminCandidateEditPage() {
  const { id } = useParams();
  const isNew = !id;
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const loaded = useRequest(`admin-candidate:${id ?? "new"}`, (signal) =>
    isNew ? Promise.resolve(null) : api<AdminCandidate>(`/admin/candidates/${id}/`, { signal })
  );
  const [candidate, setCandidate] = useState<AdminCandidate | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState<CandidateFormValues | null>(null);

  useEffect(() => { if (loaded.data) setCandidate(loaded.data); }, [loaded.data]);
  useEffect(() => { document.title = `${isNew ? "Add candidate" : candidate?.full_name ?? "Candidate"} | NDCConnect admin`; }, [isNew, candidate]);

  const save = async (values: CandidateFormValues) => {
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        const created = await api<AdminCandidate>("/admin/candidates/", { method: "POST", body: toPayload(values) });
        toast.show({ tone: "success", message: `${created.full_name} saved as a draft.` });
        navigate(`/admin/candidates/${created.id}`, { replace: true });
      } else {
        const updated = await api<AdminCandidate>(`/admin/candidates/${id}/`, { method: "PATCH", body: toPayload(values) });
        setCandidate(updated);
        setFormKey((k) => k + 1);
        toast.show(
          updated.unpublished_by_edit
            ? { tone: "warning", message: `${updated.full_name} was taken off the public page. Verify and publish again.` }
            : { tone: "success", message: "Changes saved." }
        );
      }
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const onSubmit = (values: CandidateFormValues) => {
    if (candidate?.status === "published") {
      const before = toFormValues(candidate);
      const identityChanged = IDENTITY_FIELDS.some((f) => String(before[f]).trim() !== String(values[f]).trim());
      if (identityChanged) {
        setPending(values);
        return;
      }
    }
    void save(values);
  };

  if (!isNew && loaded.error) {
    return (
      <div className="adm-page">
        {loaded.error.status === 404 ? (
          <EmptyState title="Candidate not found" action={<Button href="/admin/candidates">Back to candidates</Button>}>It may have been removed.</EmptyState>
        ) : (
          <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={loaded.retry}>Try again</Button>}>{loaded.error.message}</Banner>
        )}
      </div>
    );
  }
  if (!isNew && !candidate) {
    return <div className="adm-page" aria-busy="true"><span className="visually-hidden">Loading</span><Skeleton width="50%" height={36} /><Skeleton height={200} /></div>;
  }

  return (
    <div className="adm-page">
      <p className="adm-back"><a href="/admin/candidates">All candidates</a></p>
      <header className="adm-page__head">
        <div>
          <h1>{isNew ? "Add candidate" : candidate!.full_name}</h1>
          {candidate && (
            <div className="adm-status">
              <StatusBadge set="candidate" status={candidate.status} />
              <StatusBadge set="verification" status={candidate.is_verified ? "verified" : "not_verified"} />
              {candidate.status === "published" && <a href={`/candidates/${candidate.slug}`} target="_blank" rel="noopener noreferrer">View public profile</a>}
            </div>
          )}
        </div>
      </header>

      {candidate && (
        <section className="adm-panel" aria-labelledby="workflow-title">
          <h2 id="workflow-title">Publishing</h2>
          {candidate.is_verified && (
            <p className="ds-field__hint">Verified {candidate.verified_at ? formatDate(candidate.verified_at) : ""}{candidate.verified_by_email ? ` by ${candidate.verified_by_email}` : ""}. Note: {candidate.verification_notes}</p>
          )}
          <ActionBar candidate={candidate} onDone={(c) => { setCandidate(c); setFormKey((k) => k + 1); }} />
        </section>
      )}

      <div className="adm-layout">
        <section className="adm-panel" aria-labelledby="details-title">
          <h2 id="details-title">Details</h2>
          {candidate?.status === "archived" ? (
            <Banner tone="info">Archived candidates can’t be edited. Restore it first.</Banner>
          ) : (
            <CandidateForm key={formKey} initial={toFormValues(candidate)} submitLabel={isNew ? "Save as draft" : "Save changes"} busy={busy} error={error} onSubmit={onSubmit} />
          )}
        </section>
        {candidate && (
          <div className="adm-side">
            {candidate.followers && <FollowersPanel followers={candidate.followers} />}
            <PhotoPanel candidate={candidate} onDone={setCandidate} />
            <AccountsPanel candidate={candidate} />
            <PostsPanel candidate={candidate} />
          </div>
        )}
      </div>

      <Modal open={Boolean(pending)} onClose={() => setPending(null)} title="This takes the candidate off the public page"
        footer={<><Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button><Button loading={busy} onClick={() => pending && void save(pending)}>Save and unpublish</Button></>}>
        <p>You changed the name, office, election year or area of a published candidate. Saving removes verification and unpublishes {candidate?.full_name} until someone verifies and publishes again.</p>
      </Modal>
    </div>
  );
}
