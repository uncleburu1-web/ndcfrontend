/**
 * Tabs between admin areas (spec 11 §8.1). Which tabs show comes from the backend's `me.admin_areas`;
 * the backend enforces access anyway.
 */
import { Link } from "react-router-dom";
import { adminAreas } from "../../auth/guards";
import { useMe } from "../../auth/session";
import "./admin-nav.css";

export type AdminArea = "overview" | "candidates" | "donations" | "pvc" | "membership" | "moderation" | "news" | "announcements" | "posts" | "team"
  | "audit" | "privacy" | "integrations" | "communities";

const TABS: { id: AdminArea; label: string; href: string }[] = [
  { id: "overview", label: "Overview", href: "/admin" },
  { id: "candidates", label: "Candidates", href: "/admin/candidates" },
  { id: "donations", label: "Donations", href: "/admin/donations" },
  { id: "pvc", label: "PVC checks", href: "/admin/pvc" },
  { id: "membership", label: "Membership", href: "/admin/membership" },
  { id: "moderation", label: "Moderation", href: "/admin/moderation" },
  { id: "news", label: "News review", href: "/admin/news" },
  { id: "announcements", label: "Announcements", href: "/admin/announcements" },
  { id: "posts", label: "Candidate posts", href: "/admin/posts" },
  { id: "communities", label: "Communities", href: "/admin/communities" },
  { id: "privacy", label: "Privacy", href: "/admin/privacy" },
  { id: "team", label: "Team", href: "/admin/team" },
  { id: "audit", label: "Audit log", href: "/admin/audit" },
  { id: "integrations", label: "Integrations", href: "/admin/integrations" },
];

export function AdminNav({ current }: { current: AdminArea }) {
  const { me } = useMe();
  const areas = adminAreas(me);
  const links = TABS.filter((t) => areas.includes(t.id));
  if (links.length < 2) return null;
  return (
    <nav className="adm-nav" aria-label="Admin sections">
      {links.map((l) => (
        <Link key={l.id} to={l.href} aria-current={l.id === current ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
