/**
 * One community post or comment (spec 17 §6, §7, §14): short-name byline, the opt-in verified badge, the campaign label,
 * plain-text body, Like (count only), and the author's Edit / Delete within the rules. Hidden and removed items show a notice.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Avatar, Button, Icon, TextArea, useToast } from "../components/ui";
import { formatDate } from "../lib/format";
import { ArticleBody } from "../news/ArticleBody";
import { ReportDialog } from "../news/ReportDialog";
import type { CommunityComment, CommunityPost } from "./types";
import { postHref } from "./types";
import { t } from "../i18n";
import { InLanguage } from "../i18n/ContentLanguage";

type Item = CommunityPost | CommunityComment;

function isPost(x: Item): x is CommunityPost {
  return (x as CommunityPost).community !== undefined;
}

export function NoticeLine({ item }: { item: Item }) {
  const n = item.notice;
  if (!n) return null;
  if (n.kind === "hidden") {
    return <p className="comm-post__notice">{item.author.is_you ? t("communities.your-post-is-hidden-while-moderators") : t("communities.hidden-while-moderators-review-it")}</p>;
  }
  if (n.kind === "removed") {
    return <p className="comm-post__notice">{t.rich("communities.removed-by-moderators-read-the-rules", { v: n.rule ? t("communities.for-breaking-rule", { rule: n.rule, rule_title: n.rule_title }) : "", link: (chunks) => <Link to="/rules">{chunks}</Link> })}</p>;
  }
  return <p className="comm-post__notice">{t("communities.deleted-by-the-author")}</p>;
}

export function Byline({ item }: { item: Item }) {
  return (
    <div className="comm-post__by">
      <Avatar name={item.author.name} size="sm" />
      <span className="comm-post__name">{item.author.name}{item.author.is_you ? t("communities.you") : ""}</span>
      {item.author.verified && <span className="comm-level" title={t("communities.verified-voter-opt-in")}>{t.rich("communities.verified-voter", { icon: <Icon name="verified" size={12} /> })}</span>}
      {item.author.campaign && <span className="comm-post__campaign">{item.author.campaign}</span>}
      <span className="comm-post__time">· {formatDate(item.created_at, { withTime: true })}{item.edited_at ? t("communities.edited") : ""}</span>
    </div>
  );
}

interface Props {
  item: Item;
  /** Where Edit/Delete/Report send their requests. */
  kind: "post" | "comment";
  communityPath: string;
  showCommentsLink?: boolean;
  onChange: (next: Item | null) => void;
}

export function PostCard({ item, kind, communityPath, showCommentsLink, onChange }: Props) {
  const api = useApi();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);
  const [busy, setBusy] = useState("");
  const [reporting, setReporting] = useState(false);
  const base = kind === "post" ? `/community-posts/${item.id}/` : `/community-comments/${item.id}/`;
  const published = item.status === "published";

  const run = async (label: string, fn: () => Promise<Item | null>, done?: string) => {
    setBusy(label);
    try {
      onChange(await fn());
      if (done) toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("communities.that-didn-t-work-try-again") });
    } finally {
      setBusy("");
    }
  };

  const like = () => {
    if (!isPost(item)) return;
    const on = !item.liked;
    void run("like", async () => {
      const r = await api<{ liked: boolean; reaction_count: number }>(`${base}reaction/`, { method: on ? "PUT" : "DELETE" });
      return { ...item, liked: r.liked, reaction_count: r.reaction_count };
    });
  };

  return (
    <article className={kind === "post" ? "comm-post" : "comm-comment"} id={kind === "comment" ? `comment-${item.id}` : undefined}>
      <Byline item={item} />
      {published && !editing && <InLanguage language={(item as { language?: string }).language} className="comm-post__body"><ArticleBody body={item.body} /></InLanguage>}
      {!published && <NoticeLine item={item} />}
      {editing && (
        <div className="comm-composer">
          <TextArea label={kind === "post" ? t("communities.edit-your-post") : t("communities.edit-your-comment")} rows={4} value={draft} maxLength={kind === "post" ? 2000 : 1000}
            onChange={(e) => setDraft(e.target.value)} />
          <div className="comm-composer__row">
            <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setDraft(item.body); }}>{t("communities.cancel")}</Button>
            <Button size="sm" loading={busy === "edit"} onClick={() => void run("edit", async () => {
              const next = await api<Item>(base, { method: "PATCH", body: { body: draft } });
              setEditing(false);
              return next;
            }, t("communities.saved"))}>{t("communities.save")}</Button>
          </div>
        </div>
      )}
      {published && !editing && (
        <div className="comm-post__actions">
          {isPost(item) && (
            <Button variant="ghost" size="sm" className="comm-like" aria-pressed={item.liked} onClick={like} loading={busy === "like"}
              aria-label={t("communities.like-like", { reaction_count: item.reaction_count, v: item.reaction_count === 1 ? "" : "s" })} icon={<Icon name="heart" size={16} />}>
              {t("communities.like", { reaction_count: item.reaction_count })}
            </Button>
          )}
          {isPost(item) && showCommentsLink && (
            <Link to={postHref(communityPath, item.id)}>{t("communities.comment-2", { comment_count: item.comment_count, v: item.comment_count === 1 ? "" : "s" })}</Link>
          )}
          {item.can_edit && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{t("communities.edit")}</Button>}
          {item.can_delete && (
            <Button variant="ghost" size="sm" loading={busy === "delete"} onClick={() => {
              if (window.confirm(kind === "post" ? t("communities.delete-your-post-its-comments-go") : t("communities.delete-your-comment"))) {
                void run("delete", () => api<Item>(base, { method: "DELETE" }), t("communities.deleted"));
              }
            }}>{t("communities.delete")}</Button>
          )}
          {!item.author.is_you && (
            <Button variant="ghost" size="sm" onClick={() => setReporting(true)} aria-label={t("communities.report-by", { kind, name: item.author.name })}>{t("communities.report")}</Button>
          )}
        </div>
      )}
      <ReportDialog path={`${base}report/`} title={kind === "post" ? t("communities.report-this-post") : t("communities.report-this-comment")} open={reporting}
        onClose={() => setReporting(false)} />
    </article>
  );
}
