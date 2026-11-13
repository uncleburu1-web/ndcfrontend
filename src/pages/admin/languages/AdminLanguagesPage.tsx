/**
 * /admin/languages — spec 21 §14 (system admins, in English like the rest of the admin area, §23.4).
 * Completeness per language (this web app's catalogue and the backend's), the review sign-offs, and recording a new
 * one. A language can be switched on in Settings defaults only when both catalogues are complete and a native
 * speaker's review of the current web-app catalogue is recorded; translated legal texts also need a legal review.
 */
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { Banner, Button, RadioGroup, Select, Skeleton, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import completeness from "../../../i18n/completeness.json";
import { t } from "../../../i18n";
import { languageName } from "../../../i18n/ContentLanguage";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../../../settings/settings.css";

interface Review {
  id: string; language: string; scope: "interface" | "legal"; catalogue_version: string; interface_percent: number; backend_percent: number;
  reviewer_name: string; note: string; recorded_by: string; created_at: string;
}
interface Row {
  code: string; native: string; english: string; enabled: boolean; ready: boolean;
  backend: { total: number; translated: number; reviewed: number; percent: number };
  last_interface_review: Review | null; legal_reviewed: boolean; reviews: Review[];
}
type WebStats = { translated: number; reviewed: number; needs_update: number; total: number; percent: number };
const WEB = completeness as { version: string; total: number; languages: Record<string, WebStats> };

export default function AdminLanguagesPage() {
  const api = useApi();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ language: "ha", scope: "interface", reviewer_name: "", note: "" });
  const [busy, setBusy] = useState(false);
  const load = () => api<{ languages: Row[] }>("/admin/languages/").then((r) => setRows(r.languages))
    .catch((e) => setError(e instanceof ApiError ? e.message : t("languages.couldnt-load")));
  useEffect(() => {
    document.title = t("languages.title-page");
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const web = WEB.languages[form.language];
      await api(`/admin/languages/${form.language}/reviews/`, { method: "POST", body: {
        scope: form.scope, reviewer_name: form.reviewer_name, note: form.note,
        catalogue_version: WEB.version, interface_percent: web?.percent ?? 0 } });
      toast.show({ tone: "success", message: t("languages.review-recorded") });
      setForm({ ...form, reviewer_name: "", note: "" });
      await load();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("languages.couldnt-save") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-page">
      <AdminNav current="languages" />
      <header className="adm-page__head">
        <h1>{t("languages.heading")}</h1>
        <p className="news-note">{t("languages.intro")}</p>
      </header>
      {error && <Banner tone="error">{error}</Banner>}
      {!rows && !error && <Skeleton width="100%" height={200} />}
      {rows && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <caption className="visually-hidden">{t("languages.table-caption")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("languages.col-language")}</th>
                <th scope="col">{t("languages.col-web")}</th>
                <th scope="col">{t("languages.col-backend")}</th>
                <th scope="col">{t("languages.col-review")}</th>
                <th scope="col">{t("languages.col-legal")}</th>
                <th scope="col">{t("languages.col-status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const web = r.code === "en" ? null : WEB.languages[r.code];
                return (
                  <tr key={r.code}>
                    <th scope="row" lang={r.code}>{languageName(r.code)}</th>
                    <td>{r.code === "en" ? t("languages.source") : t("languages.percent", { percent: web?.percent ?? 0, translated: web?.translated ?? 0, total: WEB.total, reviewed: web?.reviewed ?? 0 })}</td>
                    <td>{r.code === "en" ? t("languages.source") : t("languages.percent", { percent: r.backend.percent, translated: r.backend.translated, total: r.backend.total, reviewed: r.backend.reviewed })}</td>
                    <td>{r.last_interface_review ? t("languages.reviewed-by", { name: r.last_interface_review.reviewer_name, date: formatDate(r.last_interface_review.created_at),
                      percent: r.last_interface_review.interface_percent, version: r.last_interface_review.catalogue_version }) : r.code === "en" ? "—" : t("languages.not-reviewed")}</td>
                    <td>{r.legal_reviewed ? t("languages.yes") : t("languages.not-yet")}</td>
                    <td>{r.enabled ? t("languages.on") : r.ready ? t("languages.ready") : t("languages.not-ready")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="news-note">{t.rich("languages.how-to-enable", { link: (c) => <a href="/admin/settings/defaults">{c}</a>, version: WEB.version })}</p>

      <form className="set-card" onSubmit={(e) => void submit(e)}>
        <h2>{t("languages.record-heading")}</h2>
        <Select label={t("languages.form-language")} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
          options={["ha", "ig", "yo", "pcm"].map((c) => ({ value: c, label: languageName(c) }))} />
        <RadioGroup legend={t("languages.scope")} name="scope" value={form.scope} onChange={(v) => setForm({ ...form, scope: v })}
          options={[{ value: "interface", label: t("languages.scope-interface"), hint: t("languages.scope-interface-hint", { version: WEB.version }) },
            { value: "legal", label: t("languages.scope-legal"), hint: t("languages.scope-legal-hint") }]} />
        <TextField label={t("languages.reviewer")} required maxLength={120} value={form.reviewer_name}
          onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })} hint={t("languages.reviewer-hint")} />
        <TextField label={t("languages.note")} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <Button type="submit" loading={busy} loadingLabel={t("languages.saving")}>{t("languages.record")}</Button>
      </form>
    </div>
  );
}
