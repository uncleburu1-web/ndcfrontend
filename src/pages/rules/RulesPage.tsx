/** /rules — the community rules, how reporting and appeals work, and legal contact lines (spec 13 §4.1). */
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Banner, Button, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { useRules } from "../../moderation/rules";
import "../../moderation/moderation.css";

export default function RulesPage() {
  const { rules, error } = useRules();
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "Community rules | NDCConnect";
  }, []);
  useEffect(() => {
    if (rules && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [rules, hash]);

  return (
    <div className="mod-page">
      <h1>Community rules</h1>
      <p className="mod-lead">
        These rules apply to everything public on NDCConnect: community news, official announcements, candidate posts and candidate profiles.
        Every removal names the rule it broke.
      </p>
      {error && <Banner tone="error" title="We couldn’t load the rules">Refresh the page to try again.</Banner>}
      {!rules && !error && <Skeleton width="100%" height={240} />}
      {rules && (
        <>
          <p className="mod-meta">Last updated {formatDate(rules.updated)}</p>
          {rules.draft && <Banner tone="info" title="Draft — under legal review">The wording may change once the party’s legal team has reviewed it.</Banner>}
          <ol className="mod-rules">
            {rules.rules.map((r) => (
              <li key={r.id} id={r.id} className="mod-rule" tabIndex={-1}>
                <h2><span className="mod-rule__id">{r.id}</span> {r.title}</h2>
                <p>{r.summary}</p>
                {r.examples.length > 0 && (
                  <>
                    <p className="mod-meta">Not allowed, for example:</p>
                    <ul>{r.examples.map((e) => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
                {r.law && <p className="mod-rule__law">The law behind it: {r.law}</p>}
              </li>
            ))}
          </ol>

          <h2>How reporting works</h2>
          <p>
            Anyone can report a news story, announcement, candidate post or candidate profile with the <strong>Report</strong> button.
            You get a reference so you can check progress. A person reviews every report against these rules; nothing is removed just because
            many people reported it. Urgent reports (threats, abuse, private information, false results) are reviewed within 24 hours.
          </p>
          <p><Link to="/reports/status">Check a report</Link>{" · "}<Link to="/reports">My reports</Link></p>

          <h2>Removals and appeals</h2>
          <p>
            When we remove something, its page says which rule it broke, and the author is told why. Authors can appeal once,
            within {rules.appeal_days} days. Someone other than the person who removed it decides the appeal.
          </p>

          <h2>Copyright</h2>
          <p>
            If your work was used without permission, send a copyright notice with the details the Copyright Act 2022 asks for.
            The author can send a counter-notice; if you don’t answer it within {rules.counter_notice_days} days, the content can be restored.
          </p>
          <p><Button variant="secondary" href="/report/copyright">Send a copyright notice</Button></p>

          {rules.legal_email && (
            <>
              <h2>Government agencies</h2>
              <p>Authorised government agencies can send notices to <a href={`mailto:${rules.legal_email}`}>{rules.legal_email}</a>. We acknowledge every notice.</p>
            </>
          )}

          {rules.changes.length > 0 && (
            <>
              <h2>What changed</h2>
              <ul>{rules.changes.map((c) => <li key={c.date + c.text}>{formatDate(c.date)}: {c.text}</li>)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
