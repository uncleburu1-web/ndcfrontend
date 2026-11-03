/** /privacy — the privacy notice, generated from the data register (spec 14 §4.1, §8.1). */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../../auth/session";
import { Banner, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { PrivacyNotice } from "../../privacy/types";
import "../../privacy/privacy.css";

/** Section anchors other pages link to (consent dialogs, footer). */
const ANCHORS: Record<string, string> = { follows: "follows", membership: "membership", pvc: "pvc", news: "news", donations: "donations" };

export default function PrivacyPage() {
  const api = useApi();
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [error, setError] = useState(false);
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "Privacy | NDCConnect";
    api<PrivacyNotice>("/privacy/", { anonymous: true }).then(setNotice).catch(() => setError(true));
  }, [api]);
  useEffect(() => {
    if (notice && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [notice, hash]);

  return (
    <div className="privacy-page">
      <h1>Privacy</h1>
      <p className="privacy-lead">What NDCConnect keeps about you, why, who can see it, how long it’s kept, and how to use your rights.</p>
      {error && <Banner tone="error" title="We couldn’t load the privacy notice">Refresh the page to try again.</Banner>}
      {!notice && !error && <Skeleton width="100%" height={320} />}
      {notice && (
        <>
          <p className="privacy-meta">Last updated {formatDate(notice.updated)} · version {notice.version}</p>
          {notice.draft && (
            <Banner tone="info" title="Draft — under review">The wording may change once the party’s Data Protection Officer and legal team have reviewed it.</Banner>
          )}

          <h2 id="who">Who we are</h2>
          <p>
            {notice.controller} is responsible for your data on NDCConnect (the data controller under the Nigeria Data Protection Act 2023).
            Questions or requests go to the Data Protection Officer
            {notice.contact ? <> at <a href={`mailto:${notice.contact}`}>{notice.contact}</a></> : null}, or use{" "}
            <Link to="/account/privacy">Your data</Link> when you’re signed in.
          </p>

          <h2 id="sensitive">Political opinions</h2>
          <p>
            Following candidates, applying for party membership, checking your PVC and showing the verified-voter badge can reveal your
            political opinions, which the law treats as sensitive. We ask for your explicit consent before each, and you can withdraw it at any
            time from Your data.
          </p>
          <ul className="privacy-consents">
            {notice.consents.map((c) => (
              <li key={c.key}>
                <strong>{c.label}</strong> (version {c.version}): {c.text}
              </li>
            ))}
          </ul>

          <h2 id="data">What we keep</h2>
          <div className="privacy-categories">
            {notice.categories.map((c) => (
              <section key={c.key} id={ANCHORS[c.key] ?? c.key} className="privacy-category" tabIndex={-1} aria-labelledby={`cat-${c.key}`}>
                <h3 id={`cat-${c.key}`}>
                  {c.label}
                  {c.sensitive && <span className="privacy-tag">Sensitive</span>}
                </h3>
                <dl>
                  <dt>What</dt><dd>{c.collected}</dd>
                  <dt>Why</dt><dd>{c.purpose}</dd>
                  <dt>Lawful basis</dt><dd>{c.lawful_basis}</dd>
                  <dt>Who can see it</dt><dd>{c.visible_to}</dd>
                  <dt>How long</dt><dd>{c.retention}</dd>
                  <dt>If you delete your account</dt><dd>{c.on_deletion}</dd>
                </dl>
              </section>
            ))}
          </div>

          <h2 id="processors">Who helps us, and where</h2>
          <ul className="privacy-list">
            {notice.processors.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong>: {p.role}. Location: {p.location}. Data: {p.data}. Transfer basis: {p.transfer_basis}.
              </li>
            ))}
          </ul>

          <h2 id="rights">Your rights</h2>
          <ul className="privacy-list">
            {notice.rights.map((r) => (
              <li key={r.key}><strong>{r.title}.</strong> {r.how}</li>
            ))}
          </ul>
          <p>We answer requests within {notice.request_days} days. You can also complain to the Nigeria Data Protection Commission (NDPC).</p>

          {notice.changes.length > 0 && (
            <>
              <h2 id="changes">What changed</h2>
              <ul>{notice.changes.map((c) => <li key={c.date + c.text}>{formatDate(c.date)}: {c.text}</li>)}</ul>
            </>
          )}
          <p className="privacy-meta"><Link to="/security">Report a security problem</Link></p>
        </>
      )}
    </div>
  );
}
