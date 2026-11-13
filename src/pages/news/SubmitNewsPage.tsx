/**
 * /news/submit and /news/mine/:id — submit community news, or edit it while Pending / after Rejected (spec 07 §4.3–4.4).
 * The route is wrapped in RequireProfileComplete; the backend enforces IsProfileComplete too.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { UploadProgress } from "../../media/UploadProgress";
import { checkImage, useImageUpload } from "../../media/useImageUpload";
import { Banner, Button, Checkbox, EmptyState, RadioGroup, Select, Skeleton, TextArea, TextField, useToast } from "../../components/ui";
import { STATES } from "../../lib/nigeria";
import type { MyArticle } from "../../news/types";
import "../../news/news.css";
import { getLanguage, t, lazy } from "../../i18n";
import { defaultWritingLanguage, WrittenIn } from "../../i18n/ContentLanguage";

export const TITLE_MAX = 150;
export const BODY_MIN = 100;
export const BODY_MAX = 5000;
const DECLARATIONS = lazy(() => [
  ["accurate", t("news.this-is-accurate-to-the-best")],
  ["no_private_info", t("news.it-doesn-t-share-anyone-s")],
  ["rules", t("news.i-ve-read-the-community-news")],
] as const);
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
  const { upload: uploadImage, progress } = useImageUpload("news_image");
  const navigate = useNavigate();
  const { me } = useMe();
  const [loaded, setLoaded] = useState<MyArticle | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [f, setF] = useState({ title: "", body: "", state: "", source_url: "", show_author_name: false, language: defaultWritingLanguage(getLanguage()) as string });
  const [decl, setDecl] = useState<Record<string, boolean>>({ accurate: false, no_private_info: false, rules: false });
  const [image, setImage] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = editing ? t("news.edit-your-news-ndcconnect") : t("news.submit-news-ndcconnect");
    if (!id) return;
    api<MyArticle>(`/me/news/${id}/`)
      .then((a) => {
        setLoaded(a);
        setF({ title: a.title, body: a.body, state: a.state, source_url: a.source_url, show_author_name: a.show_author_name, language: a.language ?? "und" });
      })
      .catch(() => setLoadError(true));
  }, [api, editing, id]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!f.title.trim()) e.title = t("news.give-it-a-title");
    if (f.body.trim().length < BODY_MIN) e.body = t("news.write-at-least-characters", { BODY_MIN });
    if (f.body.length > BODY_MAX) e.body = t("news.keep-it-under-characters", { BODY_MAX: BODY_MAX.toLocaleString() });
    if (f.source_url && !f.source_url.startsWith("https://")) e.source_url = t("news.use-a-link-that-starts-with");
    if (!editing) for (const [k] of DECLARATIONS) if (!decl[k]) e[`declarations.${k}`] = t("news.tick-this-to-continue");
    const imageProblem = image ? checkImage(image) : null;  // type and size before anything is sent (spec 15 §15.4)
    if (imageProblem) e.image = imageProblem.message;
    if (image && !rights) e.rights = t("news.confirm-you-took-this-photo-or");
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
        try {
          await uploadImage(image, { targetId: saved.id, url: `/me/news/${saved.id}/image/`, field: "image" });
        } catch (err) {
          toast.show({ tone: "warning", message: t("news.your-article-was-saved-but-the", { v: err instanceof ApiError ? err.message : t("news.try-again-2") }) });
        }
      }
      if (editing) {
        toast.show({ tone: "success", message: saved.status === "pending" ? t("news.saved-and-sent-for-review") : t("news.saved") });
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
        <EmptyState title={t("news.thanks-a-reviewer-will-check-it")} action={<Button href="/news/mine">{t("news.see-my-submissions")}</Button>}>
          {t("news.usually-within-a-day-you-ll")}</EmptyState>
      </div>
    );
  }
  if (loadError) return <div className="page-shell"><EmptyState title={t("news.article-not-found")} action={<Button href="/news/mine">{t("news.my-news")}</Button>} /></div>;
  if (editing && !loaded) return <div className="news-form-page"><Skeleton width="100%" height={240} /></div>;
  if (loaded && !["pending", "rejected"].includes(loaded.status)) {
    return <div className="page-shell"><EmptyState title={t("news.this-article-can-t-be-edited")} action={<Button href="/news/mine">{t("news.my-news")}</Button>}>{t("news.only-pending-or-rejected-articles-can")}</EmptyState></div>;
  }

  const over = f.body.length > BODY_MAX;
  return (
    <div className="news-form-page">
      <header>
        <p className="article-back"><Link to={editing ? "/news/mine" : "/news"}>← {editing ? t("news.my-news") : t("news.news-2")}</Link></p>
        <h1>{editing ? (loaded?.status === "rejected" ? t("news.edit-and-resubmit") : t("news.edit-your-news")) : t("news.submit-news")}</h1>
        <p className="news-note">{t("news.nothing-you-submit-is-public-until")}</p>
      </header>
      {loaded?.status === "rejected" && <Banner tone="error" title={t("news.why-it-wasn-t-approved")}>{loaded.decision_reason}</Banner>}
      <Banner tone="info">{t("news.results-must-come-from-inec-posts")}</Banner>
      <form className="news-form" onSubmit={submit} noValidate>
        {errors._form && <Banner tone="error">{errors._form}</Banner>}
        <TextField label={t("news.title")} required maxLength={TITLE_MAX} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} />
        <p className="news-counter">{f.title.length} / {TITLE_MAX}</p>
        <TextArea label={t("news.your-news")} required rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} error={errors.body}
          hint={t("news.plain-text-leave-a-blank-line")} />
        <WrittenIn value={f.language} onChange={(language) => setF({ ...f, language })} />
        <p className={`news-counter${over ? " news-counter--over" : ""}`} aria-live="polite">{f.body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</p>
        <Select label={t("news.where-is-this-about")} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}
          options={[{ value: "", label: t("news.all-of-nigeria") }, ...STATES]} />
        <TextField label={t("news.source-link-optional")} inputMode="url" value={f.source_url} placeholder="https://"
          onChange={(e) => setF({ ...f, source_url: e.target.value })} hint={t("news.where-can-readers-check-this")} error={errors.source_url} />
        <fieldset>
          <legend className="ds-field__label">{t("news.image-optional")}</legend>
          <p className="news-note">{t("news.jpeg-png-or-webp-up-to")}</p>
          {loaded?.image && !image && <div className="news-image-row"><img src={loaded.image.url_thumb} alt={t("news.current-image")} /></div>}
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("news.choose-an-image")} aria-invalid={errors.image ? true : undefined} onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          {errors.image && <p className="ds-field__error" role="alert">{errors.image}</p>}
          {image && <Checkbox label={t("news.i-took-this-photo-or-have")} checked={rights} onChange={(e) => setRights(e.target.checked)} error={errors.rights} />}
        </fieldset>
        <RadioGroup legend={t("news.byline")} name="byline" value={f.show_author_name ? "name" : "member"}
          onChange={(v) => setF({ ...f, show_author_name: v === "name" })}
          options={[{ value: "member", label: t("news.show-as-a-member") }, { value: "name", label: t("news.show-my-name-2", { v: me?.full_name || t("news.your-name") }) }]} />
        {!editing && (
          <fieldset>
            <legend className="ds-field__label">{t("news.please-confirm")}</legend>
            {DECLARATIONS.map(([k, label]) => (
              <Checkbox key={k} label={label} required checked={decl[k]} error={errors[`declarations.${k}`]} onChange={(e) => setDecl({ ...decl, [k]: e.target.checked })} />
            ))}
          </fieldset>
        )}
        <UploadProgress progress={progress} />
        <Button type="submit" loading={busy} loadingLabel={t("news.sending")}>{editing ? (loaded?.status === "rejected" ? t("news.resubmit-for-review") : t("news.save-changes")) : t("news.submit-for-review")}</Button>
      </form>
    </div>
  );
}
