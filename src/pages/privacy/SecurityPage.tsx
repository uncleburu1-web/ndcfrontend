/** /security — how to report a vulnerability (spec 14 §4.12). Wording pending the legal team's sign-off (§15.9). */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Banner } from "../../components/ui";
import "../../privacy/privacy.css";
import { t } from "../../i18n";

const CONTACT = (import.meta.env.VITE_SECURITY_CONTACT as string | undefined) ?? "";

export default function SecurityPage() {
  useEffect(() => {
    document.title = t("privacy.security-ndcconnect");
  }, []);
  return (
    <div className="privacy-page">
      <h1>{t("privacy.report-a-security-problem")}</h1>
      <p className="privacy-lead">{t("privacy.if-you-ve-found-a-weakness")}</p>
      <Banner tone="info" title={t("privacy.draft-under-legal-review")}>{t("privacy.the-safe-harbour-wording-below-may")}</Banner>

      <h2>{t("privacy.how-to-report")}</h2>
      <p>
        {t.rich("privacy.we-acknowledge-every-report-within-3", { x1: CONTACT ? (
          <>{t.rich("privacy.email", { CONTACT, a: (chunks) => <a href={`mailto:${CONTACT}`}>{chunks}</a> })}</>
        ) : (
          <>{t.rich("privacy.email-the-security-contact-listed-in", { a: (chunks) => <a href="/.well-known/security.txt">{chunks}</a> })}</>
        ) })}</p>

      <h2>{t("privacy.what-to-include")}</h2>
      <ul className="privacy-list">
        <li>{t("privacy.the-page-or-api-address-and")}</li>
        <li>{t("privacy.what-you-could-see-or-change")}</li>
        <li>{t("privacy.screenshots-or-a-short-video-if")}</li>
      </ul>

      <h2>{t("privacy.in-scope")}</h2>
      <ul className="privacy-list">
        <li>{t("privacy.the-ndcconnect-web-app-and-its")}</li>
        <li>{t("privacy.ways-to-see-another-person-s")}</li>
      </ul>

      <h2>{t("privacy.out-of-scope")}</h2>
      <ul className="privacy-list">
        <li>{t("privacy.denial-of-service-spam-or-social")}</li>
        <li>{t("privacy.clerk-s-and-paystack-s-own")}</li>
        <li>{t("privacy.missing-best-practice-headers-with-no")}</li>
      </ul>

      <h2>{t("privacy.our-promise")}</h2>
      <p>
        {t("privacy.if-you-act-in-good-faith")}</p>
      <p className="privacy-meta"><Link to="/privacy">{t("privacy.how-we-handle-your-data")}</Link></p>
    </div>
  );
}
