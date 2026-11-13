/** Spec 21 §9: moderators and news reviewers say which languages they read; "Languages I read" in the queue uses it. */
import { useEffect, useState } from "react";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { Button, Checkbox, useToast } from "../../../components/ui";
import { t } from "../../../i18n";
import { languageName } from "../../../i18n/ContentLanguage";

const CODES = ["en", "ha", "ig", "yo", "pcm"];

export function StaffLanguages() {
  const api = useApi();
  const toast = useToast();
  const [mine, setMine] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ languages: string[] }>("/admin/me/languages/").then((r) => setMine(r.languages)).catch(() => setMine(null));
  }, [api]);
  if (mine === null) return null;
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ languages: string[] }>("/admin/me/languages/", { method: "PUT", body: { languages: mine } });
      setMine(r.languages);
      setOpen(false);
      toast.show({ tone: "success", message: t("languages.staff-saved") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("languages.couldnt-save") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="set-card">
      <p className="news-meta">
        {t("languages.staff-reads", { list: mine.length ? mine.map(languageName).join(", ") : t("languages.staff-none") })}{" "}
        <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? t("languages.close") : t("languages.change")}</Button>
      </p>
      {open && (
        <fieldset>
          <legend className="ds-field__label">{t("languages.staff-legend")}</legend>
          {CODES.map((c) => (
            <Checkbox key={c} label={languageName(c)} checked={mine.includes(c)}
              onChange={(e) => setMine(e.target.checked ? [...mine, c] : mine.filter((x) => x !== c))} />
          ))}
          <Button size="sm" loading={busy} loadingLabel={t("languages.saving")} onClick={() => void save()}>{t("languages.save")}</Button>
        </fieldset>
      )}
    </div>
  );
}
