import { NavLink } from "react-router-dom";
import "../membership/admin-membership.css";

/** Team sub-nav: Roles · Access review · Users (spec 11 §4.3, 14 §4.6). */
export function TeamSubnav() {
  return (
    <nav className="adm-subnav" aria-label="Team sections">
      <NavLink to="/admin/team" end className={({ isActive }) => (isActive ? "active" : "")}>Roles</NavLink>
      <NavLink to="/admin/team/review" className={({ isActive }) => (isActive ? "active" : "")}>Access review</NavLink>
      <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>Users</NavLink>
    </nav>
  );
}
