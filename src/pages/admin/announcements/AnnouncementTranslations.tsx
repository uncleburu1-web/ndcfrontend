/**
 * Spec 21 §10: an official announcement in other languages. A person writes each version (never a machine); someone
 * else reviews and publishes it. Changing a version sends it back to draft. Editing the original marks published
 * versions "out of date" — they stay visible, with a note, until someone updates them.
 */
import { useEffect, useState } from "react";
import { ApiError } from "../../../auth/api";
import { useApi, useMe } from "../../../auth/session";
import { Banner, Button, TextArea, TextField, useToast } from "../../../components/ui";
import { ENGLISH_NAME, t } from "../../../i18n";
import { languageName } from "../../../i18n/ContentLanguage";

interface Version {
  language: string; title: string; body: string; status: "draft" | "published"; out_of_date: boolean;
  translated_by: string; reviewed_by: string; published_at: string | null; updated_at: string;
}
const VERSION_LANGUAGES = ["en", "ha", "ig", "yo", "pcm"];

export function AnnouncementTranslations({ articleId, original }: { articleId: string; original: string }) {
  const api = useApi();
  const toast = useToast();
  const { me } = useMe();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [editing, setEditing] = useState<{ language: string; title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/admin/announcements/${articleId}/translations/`;

  const load = () => api<{ versions: Version[] }>(base).then((r) => setVersions(r.versions)).catch(() => setVersions([]));
  useEffect(() => {
    void load();
  }, [articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.show({ tone: "success", message: done });
      await load();
      return true;
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("translations.couldnt-save") });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const missing = VERSION_LANGUAGES.filter((l) => l !== original && !versions?.some((v) => v.language === l));
  const myName = me?.full_name ?? "";

  return (
    <section className="adm-panel" aria-labelledby="tr-heading">
      <h2 id="tr-heading" className="adm-panel__title">{t("translations.heading")}</h2>
      <p className="news-note">{t("translations.intro", { language: languageName(original) })}</p>
      {versions === null ? null : versions.length === 0 && <p className="news-note">{t("translations.none-yet")}</p>}
      {versions?.map((v) => (
        <div key={v.language} className="set-card">
          <h3 lang={v.language}>{languageName(v.language)} · <span className={`ds-badge ds-badge--${v.status === "published" ? "success" : "warning"}`}>
            {v.status === "published" ? t("translations.status-published") : t("translations.status-draft")}</span></h3>
          <p lang={v.language}><strong>{v.title}</strong></p>
          {v.out_of_date && <Banner tone="warning">{t("translations.out-of-date")}</Banner>}
          <p className="news-meta">{t("translations.by", { translator: v.translated_by || "—", reviewer: v.reviewed_by || "—" })}</p>
          <div className="adm-actions">
            <Button size="sm" variant="secondary" onClick={() => setEditing({ language: v.language, title: v.title, body: v.body })}>
              {t("translations.edit")}</Button>
            {v.status === "draft" && (
              <Button size="sm" disabled={busy || v.translated_by === myName} onClick={() => void act(
                () => api(`${base}${v.language}/publish/`, { method: "POST" }), t("translations.published"))}>
                {t("translations.review-and-publish")}</Button>
            )}
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(
              () => api(`${base}${v.language}/`, { method: "DELETE" }), t("translations.deleted"))}>{t("translations.delete")}</Button>
          </div>
          {v.status === "draft" && v.translated_by === myName && <p className="news-note">{t("translations.someone-else")}</p>}
        </div>
      ))}
      {!editing && missing.length > 0 && (
        <div className="adm-actions">
          {missing.map((l) => (
            <Button key={l} size="sm" variant="secondary" onClick={() => setEditing({ language: l, title: "", body: "" })}>
              {t("translations.add", { name: ENGLISH_NAME[l] ?? l })}</Button>
          ))}
        </div>
      )}
      {editing && (
        <form className="set-card" onSubmit={(e) => {
          e.preventDefault();
          void act(() => api(`${base}${editing.language}/`, { method: "PUT", body: { title: editing.title, body: editing.body } }),
            t("translations.saved")).then((ok) => ok && setEditing(null));
        }}>
          <h3>{t("translations.writing", { name: languageName(editing.language) })}</h3>
          <TextField label={t("translations.title")} required maxLength={150} lang={editing.language} value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          <TextArea label={t("translations.body")} required rows={8} lang={editing.language} value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })} hint={t("translations.body-hint")} />
          <div className="adm-actions">
            <Button type="submit" loading={busy} loadingLabel={t("translations.saving")}>{t("translations.save-draft")}</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>{t("translations.cancel")}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
