/**
 * Tabs between admin areas (spec 11 §8.1). Which tabs show comes from the backend's `me.admin_areas`;
 * the backend enforces access anyway.
 */
import { Link } from "react-router-dom";
import { adminAreas } from "../../auth/guards";
import { useMe } from "../../auth/session";
import "./admin-nav.css";
import { t as tr } from "../../i18n";

export type AdminArea = "overview" | "candidates" | "donations" | "pvc" | "membership" | "moderation" | "news" | "announcements" | "posts" | "team"
  | "audit" | "privacy" | "integrations" | "communities" | "events" | "geography" | "settings" | "languages";

const TABS: { id: AdminArea; label: string; href: string }[] = [
  { id: "overview", get label() { return tr("admin.overview"); }, href: "/admin" },
  { id: "candidates", get label() { return tr("admin.candidates"); }, href: "/admin/candidates" },
  { id: "donations", get label() { return tr("admin.donations"); }, href: "/admin/donations" },
  { id: "pvc", get label() { return tr("admin.pvc-checks"); }, href: "/admin/pvc" },
  { id: "membership", get label() { return tr("admin.membership"); }, href: "/admin/membership" },
  { id: "geography", get label() { return tr("admin.geography"); }, href: "/admin/geography" },  // spec 19
  { id: "moderation", get label() { return tr("admin.moderation"); }, href: "/admin/moderation" },
  { id: "news", get label() { return tr("admin.news-review"); }, href: "/admin/news" },
  { id: "announcements", get label() { return tr("admin.announcements"); }, href: "/admin/announcements" },
  { id: "posts", get label() { return tr("admin.candidate-posts"); }, href: "/admin/posts" },
  { id: "communities", get label() { return tr("admin.communities"); }, href: "/admin/communities" },
  { id: "events", get label() { return tr("admin.events"); }, href: "/admin/events" },  // spec 18
  { id: "privacy", get label() { return tr("admin.privacy"); }, href: "/admin/privacy" },
  { id: "team", get label() { return tr("admin.team"); }, href: "/admin/team" },
  { id: "audit", get label() { return tr("admin.audit-log"); }, href: "/admin/audit" },
  { id: "integrations", get label() { return tr("admin.integrations"); }, href: "/admin/integrations" },
  { id: "settings", get label() { return tr("admin.settings-defaults"); }, href: "/admin/settings/defaults" },  // spec 20 §14
  { id: "languages", get label() { return tr("admin.languages"); }, href: "/admin/languages" },  // spec 21 §14
];

export function AdminNav({ current }: { current: AdminArea }) {
  const { me } = useMe();
  const areas = adminAreas(me);
  const links = TABS.filter((t) => areas.includes(t.id));
  if (links.length < 2) return null;
  return (
    <nav className="adm-nav" aria-label={tr("admin.admin-sections")}>
      {links.map((l) => (
        <Link key={l.id} to={l.href} aria-current={l.id === current ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
