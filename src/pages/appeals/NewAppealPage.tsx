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
import { t } from "../../i18n";

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
    document.title = t("appeals.appeal-a-decision-ndcconnect");
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
      setError(err instanceof ApiError ? err.message : t("appeals.we-couldn-t-send-your-appeal"));
    } finally {
      setBusy(false);
    }
  };

  if (res.error) return <div className="mod-page"><Banner tone="error">{res.error.message}</Banner></div>;
  if (!res.data) return <div className="mod-page"><Skeleton width="100%" height={200} /></div>;
  if (!item) return <div className="mod-page"><EmptyState title={t("appeals.nothing-to-appeal")}>{t("appeals.we-couldn-t-find-that-decision")}</EmptyState></div>;
  if (done) {
    return (
      <div className="mod-page">
        <h1>{t("appeals.appeal-sent")}</h1>
        <p>{t("appeals.someone-other-than-the-person-who")}</p>
        <p><Link to={pause || removal?.target_kind === "article" ? "/news/mine" : "/campaign"}>{t("appeals.back")}</Link></p>
      </div>
    );
  }
  return (
    <div className="mod-page">
      <h1>{t("appeals.appeal-a-decision")}</h1>
      {removal && (
        <p className="mod-lead">
          {t.rich("appeals.your-was-removed-on", { v: removal.target_kind === "article" ? t("appeals.news-story") : t("appeals.post"), title: removal.title, formatDate: formatDate(removal.decided_at), x4: removal.rule ? <> {t.rich("appeals.for-breaking", { rule: removal.rule, rule_title: removal.rule_title, link: (chunks) => <Link to={`/rules#${removal.rule}`}>{chunks}</Link> })}</> : null, x5: removal.note_to_author && <> {t("appeals.note", { note_to_author: removal.note_to_author })}</> })}
        </p>
      )}
      {pause && (
        <p className="mod-lead">
          {t.rich("appeals.your-community-news-was-paused-until", { v: pause.ends_at ? formatDate(pause.ends_at) : t("appeals.further-notice"), x2: pause.rule ? <> {t.rich("appeals.under", { rule: pause.rule, rule_title: pause.rule_title, link: (chunks) => <Link to={`/rules#${pause.rule}`}>{chunks}</Link> })}</> : null })}</p>
      )}
      {existing ? (
        <Banner tone="info" title={t("appeals.appeal", { status_label: existing.status_label })}>
          {t("appeals.you-can-appeal-each-decision-once", { v: existing.reason ? t("appeals.reason", { reason: existing.reason }) : "" })}
        </Banner>
      ) : !canAppeal ? (
        <Banner tone="warning">{t("appeals.the-14-day-window-to-appeal")}</Banner>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate>
          <p>{t("appeals.you-can-appeal-once-within-14")}</p>
          {error && <Banner tone="error">{error}</Banner>}
          <TextArea label={t("appeals.why-do-you-think-the-decision")} required rows={6} maxLength={2000} value={statement}
            onChange={(e) => setStatement(e.target.value)} hint={t("appeals.up-to-2-000-characters")} />
          <TextField label={t("appeals.link-to-evidence-optional")} inputMode="url" value={evidence} onChange={(e) => setEvidence(e.target.value)}
            hint={t("appeals.for-example-an-inec-page-or")} />
          <Button type="submit" loading={busy} loadingLabel={t("appeals.sending")} disabled={!statement.trim()}>{t("appeals.send-appeal")}</Button>
        </form>
      )}
    </div>
  );
}
