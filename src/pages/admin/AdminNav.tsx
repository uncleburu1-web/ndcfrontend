/** Tabs between admin areas. Each link is shown only to roles that can use it; the backend enforces access anyway. */
import { Link } from "react-router-dom";
import { isFinanceViewer } from "../../auth/guards";
import { useMe } from "../../auth/session";
import "./admin-nav.css";

export function AdminNav({ current }: { current: "candidates" | "donations" }) {
  const { me } = useMe();
  const links = [
    me?.is_system_admin ? { id: "candidates", label: "Candidates", href: "/admin/candidates" } : null,
    isFinanceViewer(me) ? { id: "donations", label: "Donations", href: "/admin/donations" } : null,
  ].filter(Boolean) as { id: string; label: string; href: string }[];
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
