/** Sub-navigation for /admin/privacy (spec 14 §8.2): Requests · Incidents · Data register. */
import { NavLink } from "react-router-dom";
import "../membership/admin-membership.css";

export function PrivacyNav({ current }: { current: "requests" | "incidents" | "register" }) {
  const tabs: [string, string, string][] = [
    ["requests", "Requests", "/admin/privacy"],
    ["incidents", "Incidents", "/admin/privacy/incidents"],
    ["register", "Data register", "/admin/privacy/register"],
  ];
  return (
    <nav className="adm-subnav" aria-label="Privacy">
      {tabs.map(([id, label, href]) => (
        <NavLink key={id} to={href} end className={() => (current === id ? "active" : "")} aria-current={current === id ? "page" : undefined}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
