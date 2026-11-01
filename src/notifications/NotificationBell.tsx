import { Link } from "react-router-dom";
import { Icon } from "../components/ui";
import { useUnreadCount } from "./useUnreadCount";
import "./notifications.css";

export function badgeText(n: number) {
  return n > 99 ? "99+" : String(n);
}

export function NotificationBell() {
  const unread = useUnreadCount();
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link to="/notifications" className="notif-bell" aria-label={label}>
      <Icon name="bell" size={20} />
      {unread > 0 && <span className="notif-bell__badge" aria-hidden="true">{badgeText(unread)}</span>}
    </Link>
  );
}
