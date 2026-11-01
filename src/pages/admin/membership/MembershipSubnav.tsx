/** Sub-sections of /admin/membership (spec 06 §8.2). */
import { NavLink } from "react-router-dom";

export function MembershipSubnav() {
  return (
    <nav className="adm-subnav" aria-label="Membership sections">
      <NavLink to="/admin/membership" end>Applications</NavLink>
      <NavLink to="/admin/membership/payments">Payments</NavLink>
      <NavLink to="/admin/membership/settings">Settings and register</NavLink>
    </nav>
  );
}
