/** /notifications — spec 07 §4.8. Sign-in only. */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../../auth/session";
import { Banner, Button, EmptyState, Icon, Skeleton, Switch, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { notificationsChanged } from "../../notifications/useUnreadCount";
import "../../news/news.css";

export interface NotificationItem {
  id: string;
  kind: "announcement" | "news_decision" | "pvc_decision";
  created_at: string;
  read_at: string | null;
  decision: "" | "approved" | "rejected" | "verified";
  article: { id: string; source: "official" | "community"; title: string; public: boolean } | null;
}

export function describe(n: NotificationItem) {
  if (n.kind === "pvc_decision") {
    return n.decision === "verified"
      ? { text: "Your PVC is verified. You can now join the NDC.", href: "/pvc", icon: "verified" as const }
      : { text: "We couldn’t verify your PVC. See why and try again.", href: "/pvc", icon: "shield" as const };
  }
  if (!n.article) return { text: "Notification", href: "/notifications", icon: "info" as const };
  if (n.kind === "announcement") return { text: `NDCConnect: ${n.article.title}`, href: `/news/official/${n.article.id}`, icon: "shield" as const };
  if (n.decision === "approved" && n.article.public) {
    return { text: `Your news “${n.article.title}” was published`, href: `/news/community/${n.article.id}`, icon: "checkCircle" as const };
  }
  if (n.decision === "approved") return { text: `Your news “${n.article.title}” was published`, href: "/news/mine", icon: "checkCircle" as const };
  return { text: `Your news “${n.article.title}” wasn’t approved`, href: "/news/mine", icon: "info" as const };
}

export default function NotificationsPage() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState<{ announcements: boolean } | null>(null);

  useEffect(() => {
    document.title = "Notifications | NDCConnect";
    api<{ results: NotificationItem[] }>("/me/notifications/").then((r) => setItems(r.results)).catch((e) => setError(e.message ?? "Couldn’t load."));
    api<{ announcements: boolean }>("/me/notifications/preferences/").then(setPrefs).catch(() => {});
  }, [api]);

  const open = async (n: NotificationItem) => {
    if (!n.read_at) {
      await api(`/me/notifications/${n.id}/read/`, { method: "POST" }).catch(() => {});
      notificationsChanged();
    }
    navigate(describe(n).href);
  };
  const readAll = async () => {
    await api("/me/notifications/read-all/", { method: "POST" });
    setItems((xs) => xs?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null);
    notificationsChanged();
  };
  const toggle = async (value: boolean) => {
    try {
      setPrefs(await api<{ announcements: boolean }>("/me/notifications/preferences/", { method: "PATCH", body: { announcements: value } }));
      toast.show({ tone: "success", message: value ? "You’ll get official announcements." : "Official announcements turned off." });
    } catch {
      toast.show({ tone: "error", message: "Couldn’t save that setting." });
    }
  };
  const unread = items?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="news-form-page">
      <header className="news-page__head">
        <h1>Notifications</h1>
        {unread > 0 && <Button variant="secondary" size="sm" onClick={() => void readAll()}>Mark all as read</Button>}
      </header>
      {error ? <Banner tone="error">{error}</Banner> : !items ? <Skeleton width="100%" height={160} /> : items.length === 0 ? (
        <EmptyState title="No notifications yet">
          Official announcements and decisions about your news and PVC appear here. <Link to="/news">Read the news</Link>
        </EmptyState>
      ) : (
        <ul className="notif-list">
          {items.map((n) => {
            const d = describe(n);
            return (
              <li key={n.id} className={`notif-item${n.read_at ? "" : " notif-item--unread"}`}>
                <a href={d.href} onClick={(e) => { e.preventDefault(); void open(n); }}>
                  <span className="notif-item__icon"><Icon name={d.icon} size={20} /></span>
                  <span className="notif-item__text">
                    {!n.read_at && <span className="notif-dot" aria-hidden="true" />}
                    {!n.read_at && <span className="visually-hidden">Unread: </span>}
                    {d.text}
                  </span>
                  <span className="notif-item__time">{formatDate(n.created_at, { withTime: true })}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <section className="notif-settings" aria-labelledby="notif-settings-h">
        <h2 id="notif-settings-h" className="visually-hidden">Settings</h2>
        <Switch label="Official announcements" checked={prefs?.announcements ?? true} disabled={!prefs} onChange={(v) => void toggle(v)}
          hint="Important announcements from NDCConnect. Decisions about your own news are always sent." />
      </section>
    </div>
  );
}
