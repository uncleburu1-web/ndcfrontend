/** Sub-sections of /admin/membership (spec 06 §8.2). */
import { NavLink } from "react-router-dom";
import { t } from "../../../i18n";

export function MembershipSubnav() {
  return (
    <nav className="adm-subnav" aria-label={t("admin.membership-sections")}>
      <NavLink to="/admin/membership" end>{t("admin.applications-2")}</NavLink>
      <NavLink to="/admin/membership/payments">{t("admin.payments")}</NavLink>
      <NavLink to="/admin/membership/settings">{t("admin.settings-and-register")}</NavLink>
    </nav>
  );
}
