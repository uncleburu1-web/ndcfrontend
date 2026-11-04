/** /notifications — spec 07 §4.8. Sign-in only. */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, type Schema } from "../../api/typed";
import { useApi } from "../../auth/session";
import { Banner, Button, EmptyState, Icon, Skeleton, Switch, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { notificationsChanged } from "../../notifications/useUnreadCount";
import { postPath } from "../../posts/types";
import { Avatar } from "../../components/ui";
import "../../news/news.css";

/** The API's Notification schema (generated, spec 15 §14.3): kinds, a short decision word and a link per kind. */
export type NotificationItem = Schema<"Notification">;

type Described = { text: string; href: string; icon: "shield" | "verified" | "info" | "checkCircle" | "alert" | null };

function describeModeration(n: NotificationItem): Described | null {
  const c = n.case;
  const what = c?.target_kind === "post" ? "post" : c?.target_kind === "candidate" ? "profile" : "news story";
  const own = c?.target_kind === "post" ? "/campaign" : "/news/mine";
  const rule = c?.rule && c.rule !== "LEGAL" ? ` for breaking ${c.rule}: ${c.rule_title}` : "";
  switch (n.kind) {
    case "report_outcome":
      return n.decision === "removed"
        ? { text: "We removed the content you reported. Thanks for telling us.", href: "/reports", icon: "checkCircle" }
        : { text: `We reviewed your report${c?.title ? ` about “${c.title}”` : ""}; the content stays up.`, href: "/reports", icon: "info" };
    case "content_removed":
      return { text: `Your ${what} “${c?.title ?? ""}” was removed${rule}. You can appeal.`, href: c ? `/appeals/new?case=${c.id}` : own, icon: "alert" };
    case "account_warning":
      return { text: `You received a warning${c?.rule ? ` under ${c.rule}: ${c.rule_title}` : ""}.`, href: own, icon: "alert" };
    case "submissions_paused":
      return { text: "Your community news submissions are paused. See when you can submit again, or appeal.", href: "/news/mine", icon: "alert" };
    case "appeal_decision":
      return n.decision === "upheld"
        ? { text: `Your appeal was upheld${c?.title ? `: “${c.title}”` : ""}.`, href: own, icon: "checkCircle" }
        : { text: `Your appeal wasn’t upheld${n.appeal?.reason ? `: ${n.appeal.reason}` : "."}`, href: own, icon: "info" };
    default:
      return null;
  }
}

const PRIVACY_WORDS: Record<string, string> = {
  opened: "We received your privacy request", waiting: "We need more information for your privacy request",
  reply: "There’s a reply to your privacy request", resumed: "We’re working on your privacy request again",
  done: "Your privacy request is done", refused: "We couldn’t do what your privacy request asked",
};

function describePrivacy(n: NotificationItem): Described | null {
  if (n.kind === "security_notice") {
    return { text: `Security notice: ${n.security_notice?.text ?? "see Your data"}`, href: "/account/privacy", icon: "shield" };
  }
  if (n.kind === "privacy_request_update") {
    const ref = n.privacy_request?.reference ? ` (${n.privacy_request.reference})` : "";
    return { text: `${PRIVACY_WORDS[n.decision] ?? "Update on your privacy request"}${ref}.`, href: "/account/privacy#hist-h", icon: "info" };
  }
  return null;
}

const MEMBERSHIP_WORDS: Record<string, string> = {
  approved: "Your NDC membership was approved. Welcome!", activated: "Your NDC membership is active. Welcome!",
  rejected: "Your membership application wasn’t approved. See why.", cancelled: "Your NDC membership was cancelled.",
};

/** Spec 15 §9.2: membership decisions and donation receipts (signed-in donors). No amounts in the notice. */
function describeOwnRecord(n: NotificationItem): Described | null {
  if (n.kind === "membership_decision") {
    const good = n.decision === "approved" || n.decision === "activated";
    return { text: MEMBERSHIP_WORDS[n.decision] ?? "There’s an update on your membership.", href: good ? "/membership/card" : "/join",
      icon: good ? "checkCircle" : "info" };
  }
  if (n.kind === "donation_receipt") {
    const ref = n.donation?.reference;
    return { text: `Thank you. Your donation was received${ref ? ` (${ref})` : ""}. See your receipt.`,
      href: ref ? `/donate/receipt/${encodeURIComponent(ref)}` : "/notifications", icon: "checkCircle" };
  }
  return null;
}

export function describe(n: NotificationItem): Described {
  const mod = describeModeration(n) ?? describePrivacy(n) ?? describeOwnRecord(n);
  if (mod) return mod;
  if (n.kind === "candidate_post" && n.post && n.candidate) {
    const what = n.post.kind === "announcement" ? "posted an announcement" : "posted news";
    return { text: `${n.candidate.full_name} ${what}: ${n.post.title}`, href: postPath(n.candidate.slug, n.post.id), icon: null };
  }
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
    apiGet(api, "/me/notifications/").then((r) => setItems(r.results)).catch((e) => setError(e.message ?? "Couldn’t load."));
    apiGet(api, "/me/notifications/preferences/").then(setPrefs).catch(() => {});
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
          Official announcements and decisions about your news and PVC appear here.{" "}
          Turn on the bell for candidates you follow to hear when they post. <Link to="/following">See who you follow</Link>
        </EmptyState>
      ) : (
        <ul className="notif-list">
          {items.map((n) => {
            const d = describe(n);
            return (
              <li key={n.id} className={`notif-item${n.read_at ? "" : " notif-item--unread"}`}>
                <a href={d.href} onClick={(e) => { e.preventDefault(); void open(n); }}>
                  <span className="notif-item__icon">
                    {d.icon ? <Icon name={d.icon} size={20} /> : <Avatar name={n.candidate?.full_name ?? ""} src={n.candidate?.photo?.url_200 ?? undefined} size="xs" />}
                  </span>
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
