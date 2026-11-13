/** Sub-navigation for /admin/moderation (spec 13 §4.3). */
import { NavLink } from "react-router-dom";
import { useMe } from "../../../auth/session";
import "../membership/admin-membership.css";
import { t } from "../../../i18n";

export function ModerationNav({ current, counts }: { current: string; counts?: Record<string, number> }) {
  const { me } = useMe();
  const sys = Boolean(me?.is_system_admin);
  const tabs: [string, string, string][] = [
    ["open", "Open", "/admin/moderation"],
    ["mine", "Assigned to me", "/admin/moderation?tab=mine"],
    ...(sys ? [["escalated", "Escalated", "/admin/moderation?tab=escalated"] as [string, string, string]] : []),
    ["appeals", "Appeals", "/admin/moderation/appeals"],
    ["closed", "Closed", "/admin/moderation?tab=closed"],
    ...(sys ? [["legal", "Legal notices", "/admin/moderation/legal"], ["compliance", "Compliance report", "/admin/moderation/compliance"]] as [string, string, string][] : []),
  ];
  return (
    <nav className="adm-subnav" aria-label={t("admin.moderation")}>
      {tabs.map(([id, label, href]) => (
        <NavLink key={id} to={href} end className={() => (current === id ? "active" : "")} aria-current={current === id ? "page" : undefined}>
          {label}{counts && counts[id] ? ` (${counts[id]})` : ""}
        </NavLink>
      ))}
    </nav>
  );
}
