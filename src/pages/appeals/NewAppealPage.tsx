/** /appeals/new?case=… or ?restriction=… — appeal a removal or a pause, once, within 14 days (spec 13 §4.6). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, TextArea, TextField } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { AuthorView } from "../../moderation/types";
import "../../moderation/moderation.css";

export default function NewAppealPage() {
  const api = useApi();
  const [params] = useSearchParams();
  const caseId = params.get("case");
  const restrictionId = params.get("restriction");
  const res = useRequest("my-moderation", (signal) => api<AuthorView>("/me/moderation/", { signal }));
  const [statement, setStatement] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    document.title = "Appeal a decision | NDCConnect";
  }, []);

  const removal = res.data?.removals.find((r) => r.case === caseId);
  const pause = res.data?.restrictions.find((r) => r.id === restrictionId);
  const item = removal ?? pause;
  const canAppeal = removal?.can_appeal ?? pause?.can_appeal ?? false;
  const existing = removal?.appeal ?? pause?.appeal ?? null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/me/appeals/", { method: "POST", body: { case: caseId ?? undefined, restriction: restrictionId ?? undefined, statement, evidence_url: evidence } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn’t send your appeal.");
    } finally {
      setBusy(false);
    }
  };

  if (res.error) return <div className="mod-page"><Banner tone="error">{res.error.message}</Banner></div>;
  if (!res.data) return <div className="mod-page"><Skeleton width="100%" height={200} /></div>;
  if (!item) return <div className="mod-page"><EmptyState title="Nothing to appeal">We couldn’t find that decision on your account.</EmptyState></div>;
  if (done) {
    return (
      <div className="mod-page">
        <h1>Appeal sent</h1>
        <p>Someone other than the person who made the decision will look at it. We’ll tell you the outcome in your notifications.</p>
        <p><Link to={pause || removal?.target_kind === "article" ? "/news/mine" : "/campaign"}>Back</Link></p>
      </div>
    );
  }
  return (
    <div className="mod-page">
      <h1>Appeal a decision</h1>
      {removal && (
        <p className="mod-lead">
          Your {removal.target_kind === "article" ? "news story" : "post"} “{removal.title}” was removed on {formatDate(removal.decided_at)}
          {removal.rule ? <> for breaking <Link to={`/rules#${removal.rule}`}>{removal.rule}: {removal.rule_title}</Link></> : null}.
          {removal.note_to_author && <> Note: {removal.note_to_author}</>}
        </p>
      )}
      {pause && (
        <p className="mod-lead">
          Your community news was paused until {pause.ends_at ? formatDate(pause.ends_at) : "further notice"}
          {pause.rule ? <> under <Link to={`/rules#${pause.rule}`}>{pause.rule}: {pause.rule_title}</Link></> : null}.
        </p>
      )}
      {existing ? (
        <Banner tone="info" title={`Appeal: ${existing.status_label}`}>
          You can appeal each decision once.{existing.reason ? ` Reason: ${existing.reason}` : ""}
        </Banner>
      ) : !canAppeal ? (
        <Banner tone="warning">The 14-day window to appeal this decision has closed.</Banner>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate>
          <p>You can appeal once, within 14 days of the decision. It’s decided by someone other than the person who made the decision, and the outcome is final on NDCConnect.</p>
          {error && <Banner tone="error">{error}</Banner>}
          <TextArea label="Why do you think the decision was wrong?" required rows={6} maxLength={2000} value={statement}
            onChange={(e) => setStatement(e.target.value)} hint="Up to 2,000 characters." />
          <TextField label="Link to evidence (optional)" inputMode="url" value={evidence} onChange={(e) => setEvidence(e.target.value)}
            hint="For example an INEC page or the original source." />
          <Button type="submit" loading={busy} loadingLabel="Sending…" disabled={!statement.trim()}>Send appeal</Button>
        </form>
      )}
    </div>
  );
}
