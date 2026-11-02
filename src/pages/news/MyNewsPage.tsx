/** /news/mine — the member's own submissions (spec 07 §4.4). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Modal, Skeleton, StatusBadge, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { articlePath, type MyArticle } from "../../news/types";
import { RemovalNotice, StandingBanners, useAuthorView } from "../../moderation/AuthorStanding";
import "../../news/news.css";

export default function MyNewsPage() {
  const api = useApi();
  const toast = useToast();
  const res = useRequest("my-news", (signal) => api<{ count: number; results: MyArticle[] }>("/me/news/", { signal }));
  const [items, setItems] = useState<MyArticle[] | null>(null);
  const [withdrawing, setWithdrawing] = useState<MyArticle | null>(null);
  const standing = useAuthorView();
  const pausedUntil = standing.data?.paused_until ?? null;

  useEffect(() => setItems(res.data?.results ?? null), [res.data]);
  useEffect(() => {
    document.title = "My news | NDCConnect";
  }, []);

  const replace = (a: MyArticle) => setItems((xs) => xs?.map((x) => (x.id === a.id ? a : x)) ?? null);
  const withdraw = async () => {
    if (!withdrawing) return;
    try {
      replace(await api<MyArticle>(`/me/news/${withdrawing.id}/withdraw/`, { method: "POST" }));
      toast.show({ tone: "success", message: "Withdrawn." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t withdraw." });
    } finally {
      setWithdrawing(null);
    }
  };
  const byline = async (a: MyArticle, show: boolean) => {
    try {
      replace(await api<MyArticle>(`/me/news/${a.id}/`, { method: "PATCH", body: { show_author_name: show } }));
      toast.show({ tone: "success", message: show ? "Your name is now shown." : "Now shown as “a member”." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t change the byline." });
    }
  };

  return (
    <div className="news-form-page">
      <header className="news-page__head">
        <h1>My news</h1>
        {pausedUntil ? (
          <span className="mod-meta">
            <Button variant="secondary" disabled aria-describedby="paused-why">Submit news</Button>
            <span id="paused-why" className="visually-hidden">Paused until {formatDate(pausedUntil)}</span>
          </span>
        ) : (
          <Button href="/news/submit" variant="secondary">Submit news</Button>
        )}
      </header>
      {standing.data && <StandingBanners view={standing.data} />}
      {res.error ? (
        <Banner tone="error" title="We couldn’t load your submissions" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !items ? (
        <Skeleton width="100%" height={160} />
      ) : items.length === 0 ? (
        <EmptyState title="You haven’t submitted any news yet" action={pausedUntil ? undefined : <Button href="/news/submit">Submit news</Button>} />
      ) : (
        <ul className="mine-list">
          {items.map((a) => (
            <li key={a.id} className="mine-item">
              <div className="article-badges">
                <StatusBadge set="news" status={a.status} />
                {a.status === "successful" && <span className="news-meta">published</span>}
              </div>
              <h2>{a.status === "successful" ? <Link to={articlePath(a)}>{a.title}</Link> : a.title}</h2>
              <p className="news-meta">Submitted {formatDate(a.submitted_at ?? a.created_at)} · by {a.show_author_name ? "your name" : "a member"}</p>
              {a.status === "rejected" && <Banner tone="error" title="Why it wasn’t approved">{a.decision_reason}</Banner>}
              {a.status === "removed" && (
                <RemovalNotice removal={standing.data?.removals.find((r) => r.target_id === a.id)} fallbackReason={a.removed_reason}
                  onChange={standing.retry} />
              )}
              <div className="mine-item__actions">
                {a.status === "pending" && !pausedUntil && <Button size="sm" variant="secondary" href={`/news/mine/${a.id}`}>Edit</Button>}
                {a.status === "rejected" && !pausedUntil && <Button size="sm" href={`/news/mine/${a.id}`}>Edit and resubmit</Button>}
                {a.status === "successful" && <Button size="sm" variant="secondary" href={articlePath(a)}>View</Button>}
                {["pending", "rejected", "successful"].includes(a.status) && (
                  <Button size="sm" variant="ghost" onClick={() => void byline(a, !a.show_author_name)}>
                    {a.show_author_name ? "Show as “a member”" : "Show my name"}
                  </Button>
                )}
                {["pending", "rejected", "successful"].includes(a.status) && (
                  <Button size="sm" variant="ghost" onClick={() => setWithdrawing(a)}>Withdraw</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(withdrawing)} onClose={() => setWithdrawing(null)} title="Withdraw this article?"
        footer={<><Button variant="secondary" onClick={() => setWithdrawing(null)}>Keep it</Button><Button variant="danger" onClick={() => void withdraw()}>Withdraw</Button></>}>
        <p>{withdrawing?.status === "successful" ? "This removes it from NDCConnect." : "It won’t be reviewed."} Withdrawing is final.</p>
      </Modal>
    </div>
  );
}
