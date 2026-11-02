/** /reports/status — look up a report by its reference: status only, no content (spec 13 §4.2). */
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Banner, Button, TextField } from "../../components/ui";
import "../../moderation/moderation.css";

export default function ReportStatusPage() {
  const api = useApi();
  const [ref, setRef] = useState("");
  const [result, setResult] = useState<{ reference: string; status_label: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = "Check a report | NDCConnect";
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api(`/reports/status/?reference=${encodeURIComponent(ref.trim())}`, { anonymous: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn’t check that reference.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mod-page">
      <h1>Check a report</h1>
      <p className="mod-lead">Enter the reference you got when you reported something, for example RPT-7K2Q9M.</p>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <TextField label="Reference" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" required />
        <Button type="submit" loading={busy} loadingLabel="Checking…" disabled={!ref.trim()}>Check status</Button>
      </form>
      <div aria-live="polite">
        {result && <Banner tone="info" title={result.reference}>Status: <strong>{result.status_label}</strong></Banner>}
        {error && <Banner tone="error">{error}</Banner>}
      </div>
    </div>
  );
}
