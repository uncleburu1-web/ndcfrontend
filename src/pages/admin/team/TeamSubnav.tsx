import { NavLink } from "react-router-dom";
import "../membership/admin-membership.css";
import { t } from "../../../i18n";

/** Team sub-nav: Roles · Access review · Users (spec 11 §4.3, 14 §4.6). */
export function TeamSubnav() {
  return (
    <nav className="adm-subnav" aria-label={t("admin.team-sections")}>
      <NavLink to="/admin/team" end className={({ isActive }) => (isActive ? "active" : "")}>{t("admin.roles")}</NavLink>
      <NavLink to="/admin/team/review" className={({ isActive }) => (isActive ? "active" : "")}>{t("admin.access-review")}</NavLink>
      <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>{t("admin.users")}</NavLink>
    </nav>
  );
}
