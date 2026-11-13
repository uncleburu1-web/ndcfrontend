/** /reports/status — look up a report by its reference: status only, no content (spec 13 §4.2). */
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Banner, Button, TextField } from "../../components/ui";
import "../../moderation/moderation.css";
import { t } from "../../i18n";

export default function ReportStatusPage() {
  const api = useApi();
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<{ reference: string; status_label: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = t("reports.check-a-report-ndcconnect");
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api(`/reports/status/?reference=${encodeURIComponent(ref.trim())}`, { anonymous: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("reports.we-couldn-t-check-that-reference"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mod-page">
      <h1>{t("reports.check-a-report")}</h1>
      <p className="mod-lead">{t("reports.enter-the-reference-you-got-when")}</p>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <TextField label={t("reports.reference")} value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" required />
        <Button type="submit" loading={busy} loadingLabel={t("reports.checking")} disabled={!ref.trim()}>{t("reports.check-status")}</Button>
      </form>
      <div aria-live="polite">
        {result && <Banner tone="info" title={result.reference}>{t.rich("reports.status-2", { status_label: result.status_label, strong: (chunks) => <strong>{chunks}</strong> })}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
      </div>
    </div>
  );
}
