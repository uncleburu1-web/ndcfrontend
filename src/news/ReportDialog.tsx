/**
 * Report an article, announcement, candidate post or candidate profile — spec 07 §4.6, spec 13 §4.2.
 * Reasons come with the rule they belong to; copyright goes to the s. 54 form; the person gets a reference.
 */
import { useAuth } from "@clerk/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Button, Modal, RadioGroup, TextArea, TextField, useToast } from "../components/ui";
import { useRules } from "../moderation/rules";
import { REPORT_REASONS, PROFILE_REPORT_REASONS } from "./types";
import "../moderation/moderation.css";

interface Props {
  articleId?: string;
  /** Overrides the endpoint, e.g. a candidate post's (spec 09 §4.4) or profile's (spec 13) report URL. */
  path?: string;
  title?: string;
  /** "profile": the candidate-profile reasons, decided by system admins (spec 13 §4.2). */
  variant?: "content" | "profile";
  open: boolean;
  onClose: () => void;
}

export function ReportDialog({ articleId, path, title = "Report this article", variant = "content", open, onClose }: Props) {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { rules } = useRules();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const reasons = variant === "profile"
    ? (rules?.profile_reasons ?? PROFILE_REPORT_REASONS.map(([reason, label]) => ({ reason, label }))).map((r) => ({ ...r, rule: "" }))
    : (rules?.reasons ?? REPORT_REASONS.map(([reason, label, rule]) => ({ reason, label, rule })));

  const close = () => {
    setReason("");
    setDetails("");
    setReference("");
    setError("");
    onClose();
  };

  const send = async () => {
    if (reason === "copyright") {
      close();
      navigate("/report/copyright");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const out = await api<{ reference?: string; route?: string }>(path ?? `/news/${articleId}/report/`, {
        method: "POST", body: { reason, details, contact_email: isSignedIn ? "" : email }, anonymous: !isSignedIn,
      });
      if (out.route) {
        close();
        navigate(out.route);
        return;
      }
      setReference(out.reference ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn’t send your report.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.show({ tone: "success", message: "Reference copied." });
    } catch {
      toast.show({ tone: "error", message: "Couldn’t copy. Select the reference and copy it instead." });
    }
  };

  if (reference) {
    return (
      <Modal open={open} onClose={close} title="Thanks for reporting" footer={<Button onClick={close}>Done</Button>}>
        <p>We’ll review it. Your reference is:</p>
        <p className="mod-ref"><strong>{reference}</strong> <Button size="sm" variant="secondary" onClick={() => void copy()}>Copy</Button></p>
        <p>
          {isSignedIn
            ? <>You’ll find it under <Link to="/reports" onClick={close}>My reports</Link>, and we’ll tell you when it’s decided.</>
            : <>Check its status any time at <Link to="/reports/status" onClick={close}>Check a report</Link>.</>}
        </p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={title}
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button>
        <Button onClick={() => void send()} disabled={!reason} loading={busy} loadingLabel="Sending…">
          {reason === "copyright" ? "Continue to the copyright form" : "Send report"}
        </Button></>}>
      <p>Reports are private. The author never sees who reported. A person decides every report, against our <Link to="/rules" onClick={close}>community rules</Link>.</p>
      <RadioGroup legend="What’s wrong?" name="report-reason" required value={reason} onChange={setReason}
        options={reasons.map((r) => ({
          value: r.reason,
          label: r.rule ? `${r.label} (${r.rule})` : r.label,
        }))} />
      {reason === "copyright" ? (
        <p className="ds-field__hint">Copyright complaints need a few legal details. We’ll take you to the copyright form.</p>
      ) : (
        <>
          <TextArea label="Details (optional)" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          {!isSignedIn && (
            <TextField label="Your email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              hint="Only if you’d like us to contact you about this report." />
          )}
        </>
      )}
      {error && <p className="ds-field__error" role="alert">{error}</p>}
    </Modal>
  );
}
