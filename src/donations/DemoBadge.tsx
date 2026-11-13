/** "DEMO" marker for simulated donations (seed_demo_donations, local previews only). Text, never colour alone. */
import "../components/ui/Badge.css";
import { t } from "../i18n";

export function DemoBadge() {
  return <span className="ds-badge ds-badge--warning" title={t("donations.simulated-for-a-preview-not-a")}>{t("donations.demo")}</span>;
}
