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
import { t } from "../i18n";

interface Props {
  articleId?: string;
  /** Overrides the endpoint, e.g. a candidate post's (spec 09 §4.4) or profile's (spec 13) report URL. */
  path?: string;
  title?: string;
  /** "profile": the candidate-profile reasons, decided by system admins (spec 13 §4.2). */
  variant?: "content" | "profile" | "event";
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
    : variant === "event"  // spec 18 §8: 13's reasons plus two for events (R11)
      ? (rules?.event_reasons ?? [...REPORT_REASONS.map(([reason, label, rule]) => ({ reason, label, rule })),
        { reason: "inducement", label: t("news.offers-money-or-gifts-to-attend"), rule: "R11" },
        { reason: "banned_venue", label: t("news.at-a-place-of-worship-police"), rule: "R11" }])
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
      setError(err instanceof ApiError ? err.message : t("news.we-couldn-t-send-your-report"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.show({ tone: "success", message: t("news.reference-copied") });
    } catch {
      toast.show({ tone: "error", message: t("news.couldn-t-copy-select-the-reference") });
    }
  };

  if (reference) {
    return (
      <Modal open={open} onClose={close} title={t("news.thanks-for-reporting")} footer={<Button onClick={close}>{t("news.done")}</Button>}>
        <p>{t("news.we-ll-review-it-your-reference")}</p>
        <p className="mod-ref"><strong>{reference}</strong> <Button size="sm" variant="secondary" onClick={() => void copy()}>{t("news.copy")}</Button></p>
        <p>
          {isSignedIn
            ? <>{t.rich("news.you-ll-find-it-under-my", { link: (chunks) => <Link to="/reports" onClick={close}>{chunks}</Link> })}</>
            : <>{t.rich("news.check-its-status-any-time-at", { link: (chunks) => <Link to="/reports/status" onClick={close}>{chunks}</Link> })}</>}
        </p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title={title}
      footer={<><Button variant="secondary" onClick={close}>{t("news.cancel")}</Button>
        <Button onClick={() => void send()} disabled={!reason} loading={busy} loadingLabel={t("news.sending")}>
          {reason === "copyright" ? t("news.continue-to-the-copyright-form") : t("news.send-report")}
        </Button></>}>
      <p>{t.rich("news.reports-are-private-the-author-never", { link: (chunks) => <Link to="/rules" onClick={close}>{chunks}</Link> })}</p>
      <RadioGroup legend={t("news.what-s-wrong")} name="report-reason" required value={reason} onChange={setReason}
        options={reasons.map((r) => ({
          value: r.reason,
          label: r.rule ? `${r.label} (${r.rule})` : r.label,
        }))} />
      {reason === "copyright" ? (
        <p className="ds-field__hint">{t("news.copyright-complaints-need-a-few-legal")}</p>
      ) : (
        <>
          <TextArea label={t("news.details-optional")} rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          {!isSignedIn && (
            <TextField label={t("news.your-email-optional")} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              hint={t("news.only-if-you-d-like-us")} />
          )}
        </>
      )}
      {error && <p className="ds-field__error" role="alert">{error}</p>}
    </Modal>
  );
}
