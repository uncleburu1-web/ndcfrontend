/** /privacy — the privacy notice, generated from the data register (spec 14 §4.1, §8.1). */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../../auth/session";
import { Banner, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { PrivacyNotice } from "../../privacy/types";
import "../../privacy/privacy.css";
import { getLanguage, t, useLanguage } from "../../i18n";

/** Section anchors other pages link to (consent dialogs, footer). */
const ANCHORS: Record<string, string> = { follows: "follows", membership: "membership", pvc: "pvc", news: "news", donations: "donations" };

export default function PrivacyPage() {
  const api = useApi();
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [error, setError] = useState(false);
  const { hash } = useLocation();
  const lang = useLanguage();
  useEffect(() => {
    document.title = t("privacy.privacy-ndcconnect");
    const code = getLanguage() === "qps" ? "en" : getLanguage();
    api<PrivacyNotice>(`/privacy/?lang=${code}`, { anonymous: true }).then(setNotice).catch(() => setError(true));
  }, [api, lang]);
  useEffect(() => {
    if (notice && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [notice, hash]);

  return (
    <div className="privacy-page">
      <h1>{t("privacy.privacy")}</h1>
      <p className="privacy-lead">{t("privacy.what-ndcconnect-keeps-about-you-why")}</p>
      {error && <Banner tone="error" title={t("privacy.we-couldn-t-load-the-privacy")}>{t("privacy.refresh-the-page-to-try-again")}</Banner>}
      {!notice && !error && <Skeleton width="100%" height={320} />}
      {notice && (
        <>
          <p className="privacy-meta">{t("privacy.last-updated-version", { formatDate: formatDate(notice.updated), version: notice.version })}</p>
          {notice.draft && (
            <Banner tone="info" title={t("privacy.draft-under-review")}>{t("privacy.the-wording-may-change-once-the")}</Banner>
          )}

          <h2 id="who">{t("privacy.who-we-are")}</h2>
          <p>
            {t.rich("privacy.is-responsible-for-your-data-on", { controller: notice.controller, x2: notice.contact ? <> {t.rich("privacy.at", { contact: notice.contact, a: (chunks) => <a href={`mailto:${notice.contact}`}>{chunks}</a> })}</> : null, link: (chunks) => <Link to="/settings/privacy/data">{chunks}</Link> })}</p>

          <h2 id="sensitive">{t("privacy.political-opinions")}</h2>
          <p>
            {t("privacy.following-candidates-applying-for-party-membership")}</p>
          <ul className="privacy-consents">
            {notice.consents.map((c) => (
              <li key={c.key}>
                {t.rich("privacy.version", { label: c.label, strong: (chunks) => <strong>{chunks}</strong>, version: c.version, text: c.text })}
              </li>
            ))}
          </ul>

          <h2 id="data">{t("privacy.what-we-keep")}</h2>
          <div className="privacy-categories">
            {notice.categories.map((c) => (
              <section key={c.key} id={ANCHORS[c.key] ?? c.key} className="privacy-category" tabIndex={-1} aria-labelledby={`cat-${c.key}`}>
                <h3 id={`cat-${c.key}`}>
                  {c.label}
                  {c.sensitive && <span className="privacy-tag">{t("privacy.sensitive")}</span>}
                </h3>
                <dl>
                  <dt>{t("privacy.what")}</dt><dd>{c.collected}</dd>
                  <dt>{t("privacy.why")}</dt><dd>{c.purpose}</dd>
                  <dt>{t("privacy.lawful-basis")}</dt><dd>{c.lawful_basis}</dd>
                  <dt>{t("privacy.who-can-see-it")}</dt><dd>{c.visible_to}</dd>
                  <dt>{t("privacy.how-long")}</dt><dd>{c.retention}</dd>
                  <dt>{t("privacy.if-you-delete-your-account")}</dt><dd>{c.on_deletion}</dd>
                </dl>
              </section>
            ))}
          </div>

          <h2 id="processors">{t("privacy.who-helps-us-and-where")}</h2>
          <ul className="privacy-list">
            {notice.processors.map((p) => (
              <li key={p.name}>
                {t.rich("privacy.location-data-transfer-basis", { name: p.name, strong: (chunks) => <strong>{chunks}</strong>, role: p.role, location: p.location, data: p.data, transfer_basis: p.transfer_basis })}</li>
            ))}
          </ul>

          <h2 id="rights">{t("privacy.your-rights")}</h2>
          <ul className="privacy-list">
            {notice.rights.map((r) => (
              <li key={r.key}><strong>{r.title}.</strong> {r.how}</li>
            ))}
          </ul>
          <p>{t("privacy.we-answer-requests-within-days-you", { request_days: notice.request_days })}</p>

          {notice.changes.length > 0 && (
            <>
              <h2 id="changes">{t("privacy.what-changed")}</h2>
              <ul>{notice.changes.map((c) => <li key={c.date + c.text}>{formatDate(c.date)}: {c.text}</li>)}</ul>
            </>
          )}
          <p className="privacy-meta"><Link to="/security">{t("privacy.report-a-security-problem")}</Link></p>
        </>
      )}
    </div>
  );
}
