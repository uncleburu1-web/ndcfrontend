/**
 * /campaign/:candidateId — a linked account publishes, edits and deletes its candidate's posts (spec 09 §4.1).
 * Posts go live at once (no Pending). The backend re-checks the link, the candidate's status and blackouts on every write.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Avatar, Banner, Button, Checkbox, EmptyState, Modal, RadioGroup, Skeleton, StatusBadge, TextArea, TextField, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { BODY_MAX, TITLE_MAX, postPath, type CampaignCandidate, type CampaignPost, type PostKind } from "../../posts/types";
import { KindBadge } from "../../posts/KindBadge";
import "../../news/news.css";
import "../../posts/posts.css";

type Errors = Record<string, string>;
interface Draft { kind: PostKind | ""; title: string; body: string }

function PostForm({ candidate, editing, onSaved, onCancel }: {
  candidate: CampaignCandidate; editing: CampaignPost | null; onSaved: (p: CampaignPost) => void; onCancel: () => void;
}) {
  const api = useApi();
  const toast = useToast();
  const [f, setF] = useState<Draft>({ kind: editing?.kind ?? "", title: editing?.title ?? "", body: editing?.body ?? "" });
  const [image, setImage] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = `/campaign/candidates/${candidate.id}/posts/`;

  const validate = () => {
    const e: Errors = {};
    if (!f.kind) e.kind = "Choose Announcement or News.";
    if (!f.title.trim()) e.title = "Give it a title.";
    if (!f.body.trim()) e.body = "Write the post.";
    if (f.body.length > BODY_MAX) e.body = `Keep it under ${BODY_MAX.toLocaleString()} characters.`;
    if (image && !rights) e.rights = "Confirm you took this photo or have the right to share it.";
    return e;
  };
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (!Object.keys(e).length) setConfirm(true);
  };
  const save = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      let saved = editing
        ? await api<CampaignPost>(`${base}${editing.id}/`, { method: "PATCH", body: f })
        : await api<CampaignPost>(base, { method: "POST", body: f });
      if (image) {
        const form = new FormData();
        form.append("image", image);
        form.append("rights_confirmed", "true");
        try {
          saved = await api<CampaignPost>(`${base}${saved.id}/image/`, { method: "PUT", body: form });
        } catch (err) {
          toast.show({ tone: "warning", message: `Your post is live, but the image wasn’t saved: ${err instanceof ApiError ? err.message : "try again"}` });
        }
      }
      toast.show({ tone: "success", message: editing ? "Saved. Followers weren’t notified again." : "Published." });
      onSaved(saved);
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const flat: Errors = {};
      for (const [k, v] of Object.entries(e2.fields ?? {})) flat[k] = Array.isArray(v) ? String(v[0]) : String(v);
      setErrors(Object.keys(flat).length ? flat : { _form: e2.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="campaign-form" onSubmit={submit} noValidate>
      <h2>{editing ? "Edit post" : "New post"}</h2>
      {errors._form && <Banner tone="error">{errors._form}</Banner>}
      <Banner tone="info">Posts must follow the Electoral Act 2026: no abusive or inciting language, and election results only from INEC.</Banner>
      <RadioGroup legend="Kind" name="kind" required value={f.kind} onChange={(v) => setF({ ...f, kind: v as PostKind })} error={errors.kind}
        options={[{ value: "announcement", label: "Announcement" }, { value: "news", label: "News" }]} />
      <TextField label="Title" required maxLength={TITLE_MAX} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} />
      <p className="news-counter">{f.title.length} / {TITLE_MAX}</p>
      <TextArea label="Post" required rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} error={errors.body}
        hint="Plain text. Leave a blank line between paragraphs." />
      <p className={`news-counter${f.body.length > BODY_MAX ? " news-counter--over" : ""}`}>{f.body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</p>
      <fieldset className="news-form-fieldset">
        <legend className="ds-field__label">Image (optional)</legend>
        <p className="news-note">JPEG, PNG or WebP, up to 5 MB, at least 400 px on the short side. Location data is removed.</p>
        {editing?.image && !image && <div className="news-image-row"><img src={editing.image.url_thumb} alt="Current image" /></div>}
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose an image" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        {image && <Checkbox label="We took this photo or have the right to share it." checked={rights} onChange={(e) => setRights(e.target.checked)} error={errors.rights} />}
      </fieldset>
      <div className="campaign-form__actions">
        <Button type="submit" loading={busy} loadingLabel="Saving…">{editing ? "Save changes" : "Publish"}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={editing ? "Save changes?" : "Publish now?"}
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Go back</Button><Button onClick={() => void save()}>{editing ? "Save changes" : "Publish now"}</Button></>}>
        {editing ? (
          <p>The post will show “Edited”. Followers won’t be notified again.</p>
        ) : (
          <p>
            It appears on {candidate.full_name}’s profile and in News straight away.{" "}
            {candidate.notify_count.toLocaleString()} {candidate.notify_count === 1 ? "follower" : "followers"} with notifications on will be notified.
          </p>
        )}
      </Modal>
    </form>
  );
}

export default function CampaignCandidatePage() {
  const { candidateId = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const [candidate, setCandidate] = useState<CampaignCandidate | null>(null);
  const [posts, setPosts] = useState<CampaignPost[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [mode, setMode] = useState<"list" | "new" | CampaignPost>("list");
  const [deleting, setDeleting] = useState<CampaignPost | null>(null);

  const load = useCallback(() => {
    api<{ results: CampaignPost[]; candidate: CampaignCandidate }>(`/campaign/candidates/${candidateId}/posts/`)
      .then((r) => { setPosts(r.results); setCandidate(r.candidate); })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError({})));
  }, [api, candidateId]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    document.title = candidate ? `${candidate.full_name} — My campaign | NDCConnect` : "My campaign | NDCConnect";
  }, [candidate]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/campaign/candidates/${candidateId}/posts/${deleting.id}/`, { method: "DELETE" });
      setPosts((xs) => xs?.filter((x) => x.id !== deleting.id) ?? null);
      toast.show({ tone: "success", message: "Post deleted." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t delete." });
    } finally {
      setDeleting(null);
    }
  };

  if (error?.status === 403 || error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title="You don’t have access to this page" action={<Button href="/campaign">My campaign</Button>}>
          You’re not linked to this candidate.
        </EmptyState>
      </div>
    );
  }
  if (error) return <div className="page-shell"><Banner tone="error">{error.message}</Banner></div>;
  if (!candidate || !posts) return <div className="campaign-page"><Skeleton width="100%" height={200} /></div>;

  const paused = candidate.posting_paused_until;
  const canWrite = candidate.published && !paused;
  return (
    <div className="campaign-page">
      <header className="campaign-head">
        <div className="article-badges">
          <Avatar name={candidate.full_name} src={candidate.photo?.url_200 ?? undefined} size="md" />
          <div>
            <h1>{candidate.full_name}</h1>
            <p className="news-meta">{candidate.position_label} · My campaign · {candidate.notify_count.toLocaleString()} {candidate.notify_count === 1 ? "follower" : "followers"} with notifications on</p>
          </div>
        </div>
        {mode === "list" && canWrite && <Button onClick={() => setMode("new")}>New post</Button>}
      </header>
      {paused && (
        <Banner tone="warning" title="Posting is paused">
          Campaigning ends 24 hours before polls. Posting is paused until {formatDate(paused, { withTime: true })}. You can still delete posts.
        </Banner>
      )}
      {!candidate.published && <Banner tone="warning">This candidate isn’t published, so posts can’t go out right now.</Banner>}

      {mode !== "list" ? (
        <PostForm candidate={candidate} editing={mode === "new" ? null : mode} onCancel={() => setMode("list")}
          onSaved={(p) => { setPosts((xs) => [p, ...(xs ?? []).filter((x) => x.id !== p.id)]); setMode("list"); }} />
      ) : posts.length === 0 ? (
        <EmptyState title="No posts yet" action={canWrite ? <Button onClick={() => setMode("new")}>New post</Button> : undefined}>
          Posts appear on {candidate.full_name}’s profile and in News straight away.
        </EmptyState>
      ) : (
        <ul className="campaign-list">
          {posts.map((p) => (
            <li key={p.id} className="campaign-post">
              <span className="article-badges"><StatusBadge set="post" status={p.status} /><KindBadge kind={p.kind} label={p.kind_label} /></span>
              <h2>{p.status === "published" ? <Link to={postPath(candidate.slug, p.id)}>{p.title}</Link> : p.title}</h2>
              <p className="news-meta">{formatDate(p.published_at, { withTime: true })}{p.edited_at ? ` · Edited ${formatDate(p.edited_at, { withTime: true })}` : ""}</p>
              {p.status === "removed" && <Banner tone="warning" title="Removed by NDCConnect">{p.removed_reason}</Banner>}
              <div className="campaign-post__actions">
                {p.status === "published" && canWrite && <Button size="sm" variant="secondary" onClick={() => setMode(p)}>Edit</Button>}
                {p.status !== "deleted" && <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>Delete</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete this post?"
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" onClick={() => void remove()}>Delete post</Button></>}>
        <p>This removes it from NDCConnect and from followers’ notifications. You can’t undo this.</p>
      </Modal>
    </div>
  );
}
