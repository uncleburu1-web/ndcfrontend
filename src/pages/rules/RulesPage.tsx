/** /rules — the community rules, how reporting and appeals work, and legal contact lines (spec 13 §4.1). */
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Banner, Button, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { useRules } from "../../moderation/rules";
import "../../moderation/moderation.css";
import { t } from "../../i18n";

export default function RulesPage() {
  const { rules, error } = useRules();
  const { hash } = useLocation();
  useEffect(() => {
    document.title = t("rules.community-rules-ndcconnect");
  }, []);
  useEffect(() => {
    if (rules && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [rules, hash]);

  return (
    <div className="mod-page">
      <h1>{t("rules.community-rules")}</h1>
      <p className="mod-lead">
        {t("rules.these-rules-apply-to-everything-public")}</p>
      {error && <Banner tone="error" title={t("rules.we-couldn-t-load-the-rules")}>{t("rules.refresh-the-page-to-try-again")}</Banner>}
      {!rules && !error && <Skeleton width="100%" height={240} />}
      {rules && (
        <>
          <p className="mod-meta">{t("rules.last-updated", { formatDate: formatDate(rules.updated) })}</p>
          {rules.draft && <Banner tone="info" title={t("rules.draft-under-legal-review")}>{t("rules.the-wording-may-change-once-the")}</Banner>}
          <ol className="mod-rules">
            {rules.rules.map((r) => (
              <li key={r.id} id={r.id} className="mod-rule" tabIndex={-1}>
                <h2><span className="mod-rule__id">{r.id}</span> {r.title}</h2>
                <p>{r.summary}</p>
                {r.examples.length > 0 && (
                  <>
                    <p className="mod-meta">{t("rules.not-allowed-for-example")}</p>
                    <ul>{r.examples.map((e) => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
                {r.law && <p className="mod-rule__law">{t("rules.the-law-behind-it", { law: r.law })}</p>}
              </li>
            ))}
          </ol>

          <h2>{t("rules.how-reporting-works")}</h2>
          <p>
            {t.rich("rules.anyone-can-report-a-news-story", { strong: (chunks) => <strong>{chunks}</strong> })}</p>
          <p><Link to="/reports/status">{t("rules.check-a-report")}</Link>{" · "}<Link to="/reports">{t("rules.my-reports")}</Link></p>

          <h2>{t("rules.removals-and-appeals")}</h2>
          <p>
            {t("rules.when-we-remove-something-its-page", { appeal_days: rules.appeal_days })}</p>

          <h2>{t("rules.copyright")}</h2>
          <p>
            {t("rules.if-your-work-was-used-without", { counter_notice_days: rules.counter_notice_days })}</p>
          <p><Button variant="secondary" href="/report/copyright">{t("rules.send-a-copyright-notice")}</Button></p>

          {rules.legal_email && (
            <>
              <h2>{t("rules.government-agencies")}</h2>
              <p>{t.rich("rules.authorised-government-agencies-can-send-notices", { legal_email: rules.legal_email, a: (chunks) => <a href={`mailto:${rules.legal_email}`}>{chunks}</a> })}</p>
            </>
          )}

          {rules.changes.length > 0 && (
            <>
              <h2>{t("rules.what-changed")}</h2>
              <ul>{rules.changes.map((c) => <li key={c.date + c.text}>{formatDate(c.date)}: {c.text}</li>)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
