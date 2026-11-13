/** /settings/about (spec 20 §15): versions, policies and contact. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { formatDate } from "../../lib/format";
import { SectionShell } from "../SettingsLayout";
import { t } from "../../i18n";

const CONTACT = (import.meta.env.VITE_SECURITY_CONTACT as string | undefined) ?? "";

export default function AboutSection() {
  const api = useApi();
  const [health, setHealth] = useState<{ api_version?: string; commit?: string } | null>(null);
  useEffect(() => {
    api<{ api_version?: string; commit?: string }>("/health/", { anonymous: true }).then(setHealth).catch(() => setHealth({}));
  }, [api]);
  // typeof keeps this safe in builds without the define (tests, the live-check stub)
  const commit = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";
  const built = typeof __APP_BUILT_AT__ === "string" && __APP_BUILT_AT__ ? formatDate(__APP_BUILT_AT__) : "";
  return (
    <SectionShell guestOk title={t("settings.about")}>
      <div className="set-card">
        <dl className="set-facts">
          <div><dt>{t("settings.app-version")}</dt><dd>{commit || t("settings.development-build")}{built ? t("settings.built", { built }) : ""}</dd></div>
          <div>
            <dt>{t("settings.api-version")}</dt>
            <dd>{health === null ? t("settings.checking") : health.api_version ? `${health.api_version}${health.commit ? ` · ${health.commit}` : ""}` : t("settings.unavailable-right-now")}</dd>
          </div>
        </dl>
      </div>
      <div className="set-card">
        <h3>{t("settings.policies-and-help")}</h3>
        <ul className="set-links">
          <li><Link to="/privacy">{t("settings.privacy-notice")}</Link></li>
          <li><Link to="/rules">{t("settings.community-rules")}</Link></li>
          <li><Link to="/security">{t("settings.report-a-security-problem")}</Link></li>
          <li><Link to="/finance">{t("settings.finance-donations-and-spending")}</Link></li>
          <li><Link to="/pvc">{t("settings.how-to-get-your-pvc")}</Link></li>
          <li>{t.rich("settings.contact", { x1: CONTACT ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : <a href="/.well-known/security.txt">{t("settings.see-security-txt")}</a> })}</li>
        </ul>
      </div>
      <div className="set-card">
        <p>{t("settings.ndcconnect-is-the-political-engagement-platform")}</p>
        <p className="set-meta">{t("settings.ndcconnect-isn-t-inec-only-inec")}</p>
      </div>
    </SectionShell>
  );
}
