/** Report a published article — spec 07 §4.6. Reports are private. */
import { useAuth } from "@clerk/react";
import { useState } from "react";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Button, Modal, RadioGroup, TextArea, TextField, useToast } from "../components/ui";
import { REPORT_REASONS } from "./types";

/** `path` overrides the endpoint, e.g. a candidate post's report URL (spec 09 §4.4). */
export function ReportDialog({ articleId, path, title = "Report this article", open, onClose }:
  { articleId?: string; path?: string; title?: string; open: boolean; onClose: () => void }) {
  const api = useApi();
  const toast = useToast();
  const { isSignedIn } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await api(path ?? `/news/${articleId}/report/`, { method: "POST", body: { reason, details, contact_email: isSignedIn ? "" : email }, anonymous: !isSignedIn });
      toast.show({ tone: "success", message: "Thanks. Our reviewers will look at it." });
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn’t send your report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => void send()} disabled={!reason} loading={busy} loadingLabel="Sending…">Send report</Button></>}>
      <p>Reports are private. The author never sees who reported.</p>
      <RadioGroup legend="What’s wrong?" name="report-reason" required value={reason} onChange={setReason}
        options={REPORT_REASONS.map(([value, label]) => ({ value, label }))} />
      <TextArea label="Details (optional)" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      {!isSignedIn && (
        <TextField label="Your email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          hint="Only if you’d like us to contact you about this report." />
      )}
      {error && <p className="ds-field__error" role="alert">{error}</p>}
    </Modal>
  );
}
