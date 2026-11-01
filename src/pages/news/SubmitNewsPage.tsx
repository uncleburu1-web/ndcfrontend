/**
 * /news/submit and /news/mine/:id — submit community news, or edit it while Pending / after Rejected (spec 07 §4.3–4.4).
 * The route is wrapped in RequireProfileComplete; the backend enforces IsProfileComplete too.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { Banner, Button, Checkbox, EmptyState, RadioGroup, Select, Skeleton, TextArea, TextField, useToast } from "../../components/ui";
import { STATES } from "../../lib/nigeria";
import type { MyArticle } from "../../news/types";
import "../../news/news.css";

export const TITLE_MAX = 150;
export const BODY_MIN = 100;
export const BODY_MAX = 5000;
const DECLARATIONS = [
  ["accurate", "This is accurate to the best of my knowledge."],
  ["no_private_info", "It doesn’t share anyone’s private information without their consent."],
  ["rules", "I’ve read the community news rules."],
] as const;
type Errors = Record<string, string>;

function flatten(fields: Record<string, unknown>, prefix = ""): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[key] = String(v[0]);
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
    else if (v) out[key] = String(v);
  }
  return out;
}

export default function SubmitNewsPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const { me } = useMe();
  const [loaded, setLoaded] = useState<MyArticle | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [f, setF] = useState({ title: "", body: "", state: "", source_url: "", show_author_name: false });
  const [decl, setDecl] = useState<Record<string, boolean>>({ accurate: false, no_private_info: false, rules: false });
  const [image, setImage] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = editing ? "Edit your news | NDCConnect" : "Submit news | NDCConnect";
    if (!id) return;
    api<MyArticle>(`/me/news/${id}/`)
      .then((a) => {
        setLoaded(a);
        setF({ title: a.title, body: a.body, state: a.state, source_url: a.source_url, show_author_name: a.show_author_name });
      })
      .catch(() => setLoadError(true));
  }, [api, editing, id]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!f.title.trim()) e.title = "Give it a title.";
    if (f.body.trim().length < BODY_MIN) e.body = `Write at least ${BODY_MIN} characters.`;
    if (f.body.length > BODY_MAX) e.body = `Keep it under ${BODY_MAX.toLocaleString()} characters.`;
    if (f.source_url && !f.source_url.startsWith("https://")) e.source_url = "Use a link that starts with https://";
    if (!editing) for (const [k] of DECLARATIONS) if (!decl[k]) e[`declarations.${k}`] = "Tick this to continue.";
    if (image && !rights) e.rights = "Confirm you took this photo or have the right to share it.";
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const saved = editing
        ? await api<MyArticle>(`/me/news/${id}/`, { method: "PATCH", body: f })
        : await api<MyArticle>("/me/news/", { method: "POST", body: { ...f, declarations: decl } });
      if (image) {
        const form = new FormData();
        form.append("image", image);
        form.append("rights_confirmed", "true");
        try {
          await api(`/me/news/${saved.id}/image/`, { method: "PUT", body: form });
        } catch (err) {
          toast.show({ tone: "warning", message: `Your article was saved, but the image wasn’t: ${err instanceof ApiError ? err.message : "try again"}` });
        }
      }
      if (editing) {
        toast.show({ tone: "success", message: saved.status === "pending" ? "Saved and sent for review." : "Saved." });
        navigate("/news/mine");
      } else {
        setDone(true);
      }
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const flat = flatten(e2.fields);
      setErrors(Object.keys(flat).length ? flat : { _form: e2.message });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="news-form-page">
        <EmptyState title="Thanks. A reviewer will check it." action={<Button href="/news/mine">See my submissions</Button>}>
          Usually within a day. You’ll get a notification when it’s decided.
        </EmptyState>
      </div>
    );
  }
  if (loadError) return <div className="page-shell"><EmptyState title="Article not found" action={<Button href="/news/mine">My news</Button>} /></div>;
  if (editing && !loaded) return <div className="news-form-page"><Skeleton width="100%" height={240} /></div>;
  if (loaded && !["pending", "rejected"].includes(loaded.status)) {
    return <div className="page-shell"><EmptyState title="This article can’t be edited" action={<Button href="/news/mine">My news</Button>}>Only pending or rejected articles can be edited.</EmptyState></div>;
  }

  const over = f.body.length > BODY_MAX;
  return (
    <div className="news-form-page">
      <header>
        <p className="article-back"><Link to={editing ? "/news/mine" : "/news"}>← {editing ? "My news" : "News"}</Link></p>
        <h1>{editing ? (loaded?.status === "rejected" ? "Edit and resubmit" : "Edit your news") : "Submit news"}</h1>
        <p className="news-note">Nothing you submit is public until a reviewer approves it.</p>
      </header>
      {loaded?.status === "rejected" && <Banner tone="error" title="Why it wasn’t approved">{loaded.decision_reason}</Banner>}
      <Banner tone="info">Results must come from INEC. Posts with other results will be rejected.</Banner>
      <form className="news-form" onSubmit={submit} noValidate>
        {errors._form && <Banner tone="error">{errors._form}</Banner>}
        <TextField label="Title" required maxLength={TITLE_MAX} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} />
        <p className="news-counter">{f.title.length} / {TITLE_MAX}</p>
        <TextArea label="Your news" required rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} error={errors.body}
          hint="Plain text. Leave a blank line between paragraphs." />
        <p className={`news-counter${over ? " news-counter--over" : ""}`} aria-live="polite">{f.body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</p>
        <Select label="Where is this about?" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}
          options={[{ value: "", label: "All of Nigeria" }, ...STATES]} />
        <TextField label="Source link (optional)" inputMode="url" value={f.source_url} placeholder="https://"
          onChange={(e) => setF({ ...f, source_url: e.target.value })} hint="Where can readers check this?" error={errors.source_url} />
        <fieldset>
          <legend className="ds-field__label">Image (optional)</legend>
          <p className="news-note">JPEG, PNG or WebP, up to 5 MB, at least 400 px on the short side. Location data is removed.</p>
          {loaded?.image && !image && <div className="news-image-row"><img src={loaded.image.url_thumb} alt="Current image" /></div>}
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose an image" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          {image && <Checkbox label="I took this photo or have the right to share it." checked={rights} onChange={(e) => setRights(e.target.checked)} error={errors.rights} />}
        </fieldset>
        <RadioGroup legend="Byline" name="byline" value={f.show_author_name ? "name" : "member"}
          onChange={(v) => setF({ ...f, show_author_name: v === "name" })}
          options={[{ value: "member", label: "Show as “a member”" }, { value: "name", label: `Show my name (${me?.full_name || "your name"})` }]} />
        {!editing && (
          <fieldset>
            <legend className="ds-field__label">Please confirm</legend>
            {DECLARATIONS.map(([k, label]) => (
              <Checkbox key={k} label={label} required checked={decl[k]} error={errors[`declarations.${k}`]} onChange={(e) => setDecl({ ...decl, [k]: e.target.checked })} />
            ))}
          </fieldset>
        )}
        <Button type="submit" loading={busy} loadingLabel="Sending…">{editing ? (loaded?.status === "rejected" ? "Resubmit for review" : "Save changes") : "Submit for review"}</Button>
      </form>
    </div>
  );
}
