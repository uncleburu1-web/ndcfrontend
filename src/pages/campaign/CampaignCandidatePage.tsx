/**
 * /campaign/:candidateId — a linked account publishes, edits and deletes its candidate's posts (spec 09 §4.1).
 * Posts go live at once (no Pending). The backend re-checks the link, the candidate's status and blackouts on every write.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { UploadProgress } from "../../media/UploadProgress";
import { checkImage, useImageUpload } from "../../media/useImageUpload";
import { Avatar, Banner, Button, Checkbox, EmptyState, Modal, RadioGroup, Skeleton, StatusBadge, Tabs, TextArea, TextField, useToast } from "../../components/ui";
import { CampaignVolunteers } from "../../events/CampaignVolunteers";
import { OrganiserEvents } from "../../events/OrganiserEvents";
import { formatDate } from "../../lib/format";
import { BODY_MAX, TITLE_MAX, postPath, type CampaignCandidate, type CampaignPost, type PostKind } from "../../posts/types";
import { KindBadge } from "../../posts/KindBadge";
import { RemovalNotice, useAuthorView } from "../../moderation/AuthorStanding";
import "../../news/news.css";
import "../../posts/posts.css";
import { getLanguage, t } from "../../i18n";
import { defaultWritingLanguage, WrittenIn } from "../../i18n/ContentLanguage";

type Errors = Record<string, string>;
interface Draft { kind: PostKind | ""; title: string; body: string; language: string }

function PostForm({ candidate, editing, onSaved, onCancel }: {
  candidate: CampaignCandidate; editing: CampaignPost | null; onSaved: (p: CampaignPost) => void; onCancel: () => void;
}) {
  const api = useApi();
  const toast = useToast();
  const { upload: uploadImage, progress } = useImageUpload("post_image");
  const [f, setF] = useState<Draft>({ kind: editing?.kind ?? "", title: editing?.title ?? "", body: editing?.body ?? "",
    language: editing?.language ?? defaultWritingLanguage(getLanguage()) });
  const [image, setImage] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = `/campaign/candidates/${candidate.id}/posts/`;

  const validate = () => {
    const e: Errors = {};
    if (!f.kind) e.kind = t("campaign.choose-announcement-or-news");
    if (!f.title.trim()) e.title = t("campaign.give-it-a-title");
    if (!f.body.trim()) e.body = t("campaign.write-the-post");
    if (f.body.length > BODY_MAX) e.body = t("campaign.keep-it-under-characters", { BODY_MAX: BODY_MAX.toLocaleString() });
    const imageProblem = image ? checkImage(image) : null;  // type and size before anything is sent (spec 15 §15.4)
    if (imageProblem) e.image = imageProblem.message;
    if (image && !rights) e.rights = t("campaign.confirm-you-took-this-photo-or");
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
        try {
          saved = await uploadImage<CampaignPost>(image, { targetId: saved.id, url: `${base}${saved.id}/image/`, field: "image" });
        } catch (err) {
          toast.show({ tone: "warning", message: t("campaign.your-post-is-live-but-the", { v: err instanceof ApiError ? err.message : t("campaign.try-again") }) });
        }
      }
      toast.show({ tone: "success", message: editing ? t("campaign.saved-followers-weren-t-notified-again") : t("campaign.published") });
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
      <h2>{editing ? t("campaign.edit-post") : t("campaign.new-post")}</h2>
      {errors._form && <Banner tone="error">{errors._form}</Banner>}
      <Banner tone="info">{t("campaign.posts-must-follow-the-electoral-act")}</Banner>
      <RadioGroup legend={t("campaign.kind")} name="kind" required value={f.kind} onChange={(v) => setF({ ...f, kind: v as PostKind })} error={errors.kind}
        options={[{ value: "announcement", label: t("campaign.announcement") }, { value: "news", label: t("campaign.news") }]} />
      <TextField label={t("campaign.title")} required maxLength={TITLE_MAX} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} />
      <p className="news-counter">{f.title.length} / {TITLE_MAX}</p>
      <TextArea label={t("campaign.post")} required rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} error={errors.body}
        hint={t("campaign.plain-text-leave-a-blank-line")} />
      <WrittenIn value={f.language} onChange={(language) => setF({ ...f, language })} />
      <p className={`news-counter${f.body.length > BODY_MAX ? " news-counter--over" : ""}`}>{f.body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</p>
      <fieldset className="news-form-fieldset">
        <legend className="ds-field__label">{t("campaign.image-optional")}</legend>
        <p className="news-note">{t("campaign.jpeg-png-or-webp-up-to")}</p>
        {editing?.image && !image && <div className="news-image-row"><img src={editing.image.url_thumb} alt={t("campaign.current-image")} /></div>}
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("campaign.choose-an-image")} aria-invalid={errors.image ? true : undefined} onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        {errors.image && <p className="ds-field__error" role="alert">{errors.image}</p>}
        {image && <Checkbox label={t("campaign.we-took-this-photo-or-have")} checked={rights} onChange={(e) => setRights(e.target.checked)} error={errors.rights} />}
      </fieldset>
      <div className="campaign-form__actions">
        <UploadProgress progress={progress} />
        <Button type="submit" loading={busy} loadingLabel={t("campaign.saving")}>{editing ? t("campaign.save-changes") : t("campaign.publish")}</Button>
        <Button variant="secondary" onClick={onCancel}>{t("campaign.cancel")}</Button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={editing ? t("campaign.save-changes-2") : t("campaign.publish-now")}
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{t("campaign.go-back")}</Button><Button onClick={() => void save()}>{editing ? t("campaign.save-changes") : t("campaign.publish-now-2")}</Button></>}>
        {editing ? (
          <p>{t("campaign.the-post-will-show-edited-followers")}</p>
        ) : (
          <p>
            {t("campaign.it-appears-on-s-profile-and", { full_name: candidate.full_name, notify_count: candidate.notify_count.toLocaleString() })}</p>
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
  const [tab, setTab] = useState("posts");  // spec 18: Posts · Events · Volunteers
  const standing = useAuthorView();

  const load = useCallback(() => {
    api<{ results: CampaignPost[]; candidate: CampaignCandidate }>(`/campaign/candidates/${candidateId}/posts/`)
      .then((r) => { setPosts(r.results); setCandidate(r.candidate); })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError({})));
  }, [api, candidateId]);
  useEffect(() => load(), [load]);
  useEffect(() => {
    document.title = candidate ? t("campaign.my-campaign-ndcconnect", { full_name: candidate.full_name }) : t("campaign.my-campaign-ndcconnect-2");
  }, [candidate]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/campaign/candidates/${candidateId}/posts/${deleting.id}/`, { method: "DELETE" });
      setPosts((xs) => xs?.filter((x) => x.id !== deleting.id) ?? null);
      toast.show({ tone: "success", message: t("campaign.post-deleted") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("campaign.couldn-t-delete") });
    } finally {
      setDeleting(null);
    }
  };

  if (error?.status === 403 || error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title={t("campaign.you-don-t-have-access-to")} action={<Button href="/campaign">{t("campaign.my-campaign")}</Button>}>
          {t("campaign.you-re-not-linked-to-this")}</EmptyState>
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
            <p className="news-meta">{t("campaign.my-campaign-other-with-notifications-on", { position_label: candidate.position_label, notify_count: candidate.notify_count.toLocaleString() })}</p>
          </div>
        </div>
        {tab === "posts" && mode === "list" && canWrite && <Button onClick={() => setMode("new")}>{t("campaign.new-post")}</Button>}
      </header>
      {paused && (
        <Banner tone="warning" title={t("campaign.posting-is-paused")}>
          {t("campaign.campaigning-ends-24-hours-before-polls", { formatDate: formatDate(paused, { withTime: true }) })}</Banner>
      )}
      {!candidate.published && <Banner tone="warning">{t("campaign.this-candidate-isn-t-published-so")}</Banner>}

      <Tabs label={t("campaign.campaign-sections")} value={tab} onChange={setTab} tabs={[
        { id: "posts", label: t("campaign.posts"), content: (<>
      {mode !== "list" ? (
        <PostForm candidate={candidate} editing={mode === "new" ? null : mode} onCancel={() => setMode("list")}
          onSaved={(p) => { setPosts((xs) => [p, ...(xs ?? []).filter((x) => x.id !== p.id)]); setMode("list"); }} />
      ) : posts.length === 0 ? (
        <EmptyState title={t("campaign.no-posts-yet")} action={canWrite ? <Button onClick={() => setMode("new")}>{t("campaign.new-post")}</Button> : undefined}>
          {t("campaign.posts-appear-on-s-profile-and", { full_name: candidate.full_name })}</EmptyState>
      ) : (
        <ul className="campaign-list">
          {posts.map((p) => (
            <li key={p.id} className="campaign-post">
              <span className="article-badges"><StatusBadge set="post" status={p.status} /><KindBadge kind={p.kind} label={p.kind_label} /></span>
              <h2>{p.status === "published" ? <Link to={postPath(candidate.slug, p.id)}>{p.title}</Link> : p.title}</h2>
              <p className="news-meta">{formatDate(p.published_at, { withTime: true })}{p.edited_at ? t("campaign.edited", { formatDate: formatDate(p.edited_at, { withTime: true }) }) : ""}</p>
              {p.status === "removed" && (
                <RemovalNotice removal={standing.data?.removals.find((r) => r.target_id === p.id)} fallbackReason={p.removed_reason}
                  onChange={standing.retry} />
              )}
              <div className="campaign-post__actions">
                {p.status === "published" && canWrite && <Button size="sm" variant="secondary" onClick={() => setMode(p)}>{t("campaign.edit")}</Button>}
                {p.status !== "deleted" && <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>{t("campaign.delete")}</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
        </>) },
        { id: "events", label: t("campaign.events"), content: <OrganiserEvents base={`/campaign/${candidateId}/events/`} canWrite={candidate.published} /> },
        { id: "volunteers", label: t("campaign.volunteers"), content: <CampaignVolunteers candidateId={candidateId} /> },
      ]} />
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={t("campaign.delete-this-post")}
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>{t("campaign.keep-it")}</Button><Button variant="danger" onClick={() => void remove()}>{t("campaign.delete-post")}</Button></>}>
        <p>{t("campaign.this-removes-it-from-ndcconnect-and")}</p>
      </Modal>
    </div>
  );
}
