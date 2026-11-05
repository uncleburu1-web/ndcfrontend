/** /admin/announcements/new and /:id — publish or edit an official announcement (spec 07 §4.7). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { UploadProgress } from "../../../media/UploadProgress";
import { checkImage, useImageUpload } from "../../../media/useImageUpload";
import { Banner, Button, Checkbox, EmptyState, Modal, Select, Skeleton, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { STATES } from "../../../lib/nigeria";
import { CATEGORIES, articlePath, type AdminArticle } from "../../../news/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../../../news/news.css";

type Errors = Record<string, string>;
const EMPTY = { category: "", title: "", body: "", state: "", source_name: "", source_url: "", audience_community: "" };

export default function AnnouncementFormPage() {
  const { id } = useParams();
  const api = useApi();
  const toast = useToast();
  const { upload: uploadImage, progress } = useImageUpload("announcement_image");
  const navigate = useNavigate();
  const [a, setA] = useState<AdminArticle | null>(null);
  const [f, setF] = useState(EMPTY);
  const [notify, setNotify] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const [reason, setReason] = useState("");
  const [pinPrompt, setPinPrompt] = useState<AdminArticle[] | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Spec 17 §9: show pinned in one community and every level below it
  const [tops, setTops] = useState<{ id: string; name: string; level: string }[]>([]);
  const [lgas, setLgas] = useState<{ id: string; name: string }[]>([]);
  const [top, setTop] = useState("");
  const [currentAudience, setCurrentAudience] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    api<{ id: string; name: string; level: string }[]>("/communities/", { anonymous: true }).then(setTops).catch(() => {});
  }, [api]);
  useEffect(() => {
    setLgas([]);
    if (!top || tops.find((t) => t.id === top)?.level !== "state") return;
    api<{ id: string; name: string }[]>(`/communities/?parent=${top}`, { anonymous: true }).then(setLgas).catch(() => {});
  }, [api, top, tops]);

  useEffect(() => {
    document.title = id ? "Edit announcement | NDCConnect admin" : "New announcement | NDCConnect admin";
    if (!id) return;
    api<AdminArticle>(`/admin/announcements/${id}/`).then((x) => {
      setA(x);
      setF({ category: x.category, title: x.title, body: x.body, state: x.state, source_name: x.source_name, source_url: x.source_url,
        audience_community: x.audience?.id ?? "" });
      if (x.audience) setCurrentAudience(x.audience);
    }).catch(() => setNotFound(true));
  }, [api, id]);

  const validate = () => {
    const e: Errors = {};
    if (!f.category) e.category = "Choose a category.";
    if (!f.title.trim()) e.title = "Give it a title.";
    if (!f.body.trim()) e.body = "Write the announcement.";
    if (f.category === "community" && !f.audience_community && !id) e.audience_community = "Community Announcements need a community to show in.";
    if (f.source_url && !f.source_url.startsWith("https://")) e.source_url = "Use a link that starts with https://";
    if (f.category === "election_updates" && !(f.source_name.trim() && f.source_url)) {
      e.source_name = "Official Election Updates need a source (e.g. INEC).";
      if (!f.source_url) e.source_url = "Add the link to the source.";
    }
    const imageProblem = image ? checkImage(image) : null;  // type and size before anything is sent (spec 15 §15.4)
    if (imageProblem) e.image = imageProblem.message;
    if (image && !rights) e.rights = "Confirm NDCConnect may publish this image.";
    return e;
  };

  const save = async () => {
    setBusy(true);
    setConfirm(null);
    try {
      const saved = id
        ? await api<AdminArticle>(`/admin/announcements/${id}/`, { method: "PATCH", body: { ...f, audience_community: f.audience_community || null } })
        : await api<AdminArticle>("/admin/announcements/", { method: "POST", body: { ...f, audience_community: f.audience_community || null, notify } });
      let final = saved;
      if (image) {
        try {
          final = await uploadImage<AdminArticle>(image, { targetId: saved.id, url: `/admin/announcements/${saved.id}/image/`, field: "image" });
        } catch (err) {
          toast.show({ tone: "warning", message: `Saved without the image: ${err instanceof ApiError ? err.message : "try again"}` });
        }
      }
      toast.show({ tone: "success", message: id ? "Updated." : notify ? "Published. Everyone is being notified." : "Published." });
      if (id) setA(final);
      else navigate(`/admin/announcements/${saved.id}`);
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const flat: Errors = {};
      for (const [k, v] of Object.entries(e2.fields ?? {})) flat[k] = Array.isArray(v) ? String(v[0]) : String(v);
      setErrors(Object.keys(flat).length ? flat : { _form: e2.message });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!id && notify) {
      const r = await api<{ count: number }>("/admin/announcements/notify-count/").catch(() => ({ count: 0 }));
      setConfirm(r.count);
      return;
    }
    void save();
  };

  const action = async (name: "pin" | "unpin" | "unpublish" | "restore", body?: Record<string, string>) => {
    try {
      setA(await api<AdminArticle>(`/admin/announcements/${id}/${name}/`, { method: "POST", body }));
      setUnpublishing(false);
      setReason("");
      toast.show({ tone: "success", message: { pin: "Pinned to the top of News.", unpin: "Unpinned.", unpublish: "Unpublished.", restore: "Restored." }[name] });
    } catch (err) {
      if (err instanceof ApiError && err.code === "too_many_pinned") {
        const list = await api<{ results: AdminArticle[] }>("/admin/announcements/");
        setPinPrompt(list.results.filter((x) => x.pinned));
        return;
      }
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work." });
    }
  };
  const swapPin = async (unpinId: string) => {
    await api(`/admin/announcements/${unpinId}/unpin/`, { method: "POST" });
    setPinPrompt(null);
    void action("pin");
  };

  if (notFound) {
    return <div className="adm-page"><AdminNav current="announcements" /><EmptyState title="Announcement not found" action={<Button href="/admin/announcements">Back to announcements</Button>} /></div>;
  }
  if (id && !a) return <div className="adm-page"><AdminNav current="announcements" /><Skeleton width="100%" height={240} /></div>;
  return (
    <div className="adm-page">
      <AdminNav current="announcements" />
      <p className="adm-back"><Link to="/admin/announcements">← Announcements</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{id ? "Edit announcement" : "New announcement"}</h1>
          {a && <p className="ds-field__hint">Published {a.published_at ? formatDate(a.published_at, { withTime: true }) : ""}{a.edited_at ? ` · Updated ${formatDate(a.edited_at, { withTime: true })}` : ""}</p>}
        </div>
        {a && (
          <div className="adm-actions">
            {a.status === "successful" && <Button variant="secondary" href={articlePath(a)}>View on News</Button>}
            {a.status === "successful" && (a.pinned ? <Button variant="secondary" onClick={() => void action("unpin")}>Unpin</Button>
              : <Button variant="secondary" onClick={() => void action("pin")}>Pin to the top of News</Button>)}
            {a.status === "successful" && <Button variant="ghost" onClick={() => setUnpublishing(true)}>Unpublish</Button>}
            {a.status === "removed" && <Button variant="secondary" onClick={() => void action("restore")}>Restore</Button>}
          </div>
        )}
      </header>
      {a?.status === "removed" && <Banner tone="warning" title="Unpublished">{a.removed_reason}</Banner>}
      <form className="news-form adm-panel" onSubmit={onSubmit} noValidate>
        {errors._form && <Banner tone="error">{errors._form}</Banner>}
        <Select label="Category" required value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} error={errors.category}
          options={[{ value: "", label: "Choose a category" }, ...CATEGORIES.map(([value, label]) => ({ value, label }))]} />
        <TextField label="Title" required maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} />
        <TextArea label="Announcement" required rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} error={errors.body}
          hint="Plain text. Leave a blank line between paragraphs." />
        <p className="news-counter">{f.body.length.toLocaleString()} / 20,000</p>
        <Select label={f.category === "community" ? "Show pinned in" : "Show pinned in a community (optional)"} required={f.category === "community"}
          value={top || (currentAudience && f.audience_community === currentAudience.id ? currentAudience.id : "")}
          onChange={(e) => { setTop(e.target.value); setF({ ...f, audience_community: e.target.value }); }} error={errors.audience_community}
          options={[{ value: "", label: "No community (the News page only)" },
            ...(currentAudience && !tops.some((t) => t.id === currentAudience.id) ? [{ value: currentAudience.id, label: `${currentAudience.name} (current)` }] : []),
            ...tops.map((t) => ({ value: t.id, label: t.name }))]}
          hint="Pinned for 30 days in this community and every level below it; its members with announcements on are notified." />
        {lgas.length > 0 && (
          <Select label="LGA (optional)" value={lgas.some((l) => l.id === f.audience_community) ? f.audience_community : ""}
            onChange={(e) => setF({ ...f, audience_community: e.target.value || top })}
            options={[{ value: "", label: "The whole state" }, ...lgas.map((l) => ({ value: l.id, label: l.name }))]} />
        )}
        <Select label="State (optional)" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}
          options={[{ value: "", label: "All of Nigeria" }, ...STATES]} hint="Only filters the News page; everyone can read it." />
        <TextField label={f.category === "election_updates" ? "Source name" : "Source name (optional)"} required={f.category === "election_updates"}
          value={f.source_name} onChange={(e) => setF({ ...f, source_name: e.target.value })} error={errors.source_name} placeholder="e.g. INEC" />
        <TextField label={f.category === "election_updates" ? "Source link" : "Source link (optional)"} required={f.category === "election_updates"}
          inputMode="url" value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} error={errors.source_url} placeholder="https://" />
        <fieldset>
          <legend className="ds-field__label">Image (optional)</legend>
          {a?.image && !image && <div className="news-image-row"><img src={a.image.url_thumb} alt="Current image" /></div>}
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose an image" aria-invalid={errors.image ? true : undefined} onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          {errors.image && <p className="ds-field__error" role="alert">{errors.image}</p>}
          {image && <Checkbox label="NDCConnect has the right to publish this image." checked={rights} onChange={(e) => setRights(e.target.checked)} error={errors.rights} />}
        </fieldset>
        {!id && (
          <Checkbox label="Notify everyone" checked={notify} onChange={(e) => setNotify(e.target.checked)}
            hint="Send an in-app notification to all users who haven’t turned announcements off. Use it for important announcements only." />
        )}
        <UploadProgress progress={progress} />
        <Button type="submit" loading={busy} loadingLabel="Saving…">{id ? "Save changes" : "Publish now"}</Button>
      </form>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Publish and notify everyone?"
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Go back</Button><Button onClick={() => void save()}>Publish and notify</Button></>}>
        <p>{confirm?.toLocaleString()} users will get an in-app notification. Edits later won’t notify again.</p>
      </Modal>
      <Modal open={unpublishing} onClose={() => setUnpublishing(false)} title="Unpublish this announcement?"
        footer={<><Button variant="secondary" onClick={() => setUnpublishing(false)}>Go back</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => void action("unpublish", { reason })}>Unpublish</Button></>}>
        <p>It disappears from News. You can restore it later.</p>
        <TextArea label="Reason" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
      <Modal open={Boolean(pinPrompt)} onClose={() => setPinPrompt(null)} title="Three announcements are already pinned"
        footer={<Button variant="secondary" onClick={() => setPinPrompt(null)}>Cancel</Button>}>
        <p>Choose one to unpin:</p>
        <div className="adm-actions">
          {pinPrompt?.map((p) => <Button key={p.id} variant="secondary" size="sm" onClick={() => void swapPin(p.id)}>Unpin “{p.title}”</Button>)}
        </div>
      </Modal>
    </div>
  );
}
