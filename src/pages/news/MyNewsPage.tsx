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
import { t } from "../../i18n";

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
    document.title = t("news.my-news-ndcconnect");
  }, []);

  const replace = (a: MyArticle) => setItems((xs) => xs?.map((x) => (x.id === a.id ? a : x)) ?? null);
  const withdraw = async () => {
    if (!withdrawing) return;
    try {
      replace(await api<MyArticle>(`/me/news/${withdrawing.id}/withdraw/`, { method: "POST" }));
      toast.show({ tone: "success", message: t("news.withdrawn") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("news.couldn-t-withdraw") });
    } finally {
      setWithdrawing(null);
    }
  };
  const byline = async (a: MyArticle, show: boolean) => {
    try {
      replace(await api<MyArticle>(`/me/news/${a.id}/`, { method: "PATCH", body: { show_author_name: show } }));
      toast.show({ tone: "success", message: show ? t("news.your-name-is-now-shown") : t("news.now-shown-as-a-member") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("news.couldn-t-change-the-byline") });
    }
  };

  return (
    <div className="news-form-page">
      <header className="news-page__head">
        <h1>{t("news.my-news")}</h1>
        {pausedUntil ? (
          <span className="mod-meta">
            <Button variant="secondary" disabled aria-describedby="paused-why">{t("news.submit-news")}</Button>
            <span id="paused-why" className="visually-hidden">{t("news.paused-until", { formatDate: formatDate(pausedUntil) })}</span>
          </span>
        ) : (
          <Button href="/news/submit" variant="secondary">{t("news.submit-news")}</Button>
        )}
      </header>
      {standing.data && <StandingBanners view={standing.data} />}
      {res.error ? (
        <Banner tone="error" title={t("news.we-couldn-t-load-your-submissions")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("news.try-again")}</Button>}>{res.error.message}</Banner>
      ) : !items ? (
        <Skeleton width="100%" height={160} />
      ) : items.length === 0 ? (
        <EmptyState title={t("news.you-haven-t-submitted-any-news")} action={pausedUntil ? undefined : <Button href="/news/submit">{t("news.submit-news")}</Button>} />
      ) : (
        <ul className="mine-list">
          {items.map((a) => (
            <li key={a.id} className="mine-item">
              <div className="article-badges">
                <StatusBadge set="news" status={a.status} />
                {a.status === "successful" && <span className="news-meta">{t("news.published")}</span>}
              </div>
              <h2>{a.status === "successful" ? <Link to={articlePath(a)}>{a.title}</Link> : a.title}</h2>
              <p className="news-meta">{t("news.submitted-by", { formatDate: formatDate(a.submitted_at ?? a.created_at), v: a.show_author_name ? t("news.your-name") : t("news.a-member") })}</p>
              {a.status === "rejected" && <Banner tone="error" title={t("news.why-it-wasn-t-approved")}>{a.decision_reason}</Banner>}
              {a.status === "removed" && (
                <RemovalNotice removal={standing.data?.removals.find((r) => r.target_id === a.id)} fallbackReason={a.removed_reason}
                  onChange={standing.retry} />
              )}
              <div className="mine-item__actions">
                {a.status === "pending" && !pausedUntil && <Button size="sm" variant="secondary" href={`/news/mine/${a.id}`}>{t("news.edit")}</Button>}
                {a.status === "rejected" && !pausedUntil && <Button size="sm" href={`/news/mine/${a.id}`}>{t("news.edit-and-resubmit")}</Button>}
                {a.status === "successful" && <Button size="sm" variant="secondary" href={articlePath(a)}>{t("news.view")}</Button>}
                {["pending", "rejected", "successful"].includes(a.status) && (
                  <Button size="sm" variant="ghost" onClick={() => void byline(a, !a.show_author_name)}>
                    {a.show_author_name ? t("news.show-as-a-member") : t("news.show-my-name")}
                  </Button>
                )}
                {["pending", "rejected", "successful"].includes(a.status) && (
                  <Button size="sm" variant="ghost" onClick={() => setWithdrawing(a)}>{t("news.withdraw")}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(withdrawing)} onClose={() => setWithdrawing(null)} title={t("news.withdraw-this-article")}
        footer={<><Button variant="secondary" onClick={() => setWithdrawing(null)}>{t("news.keep-it")}</Button><Button variant="danger" onClick={() => void withdraw()}>{t("news.withdraw")}</Button></>}>
        <p>{t("news.withdrawing-is-final", { v: withdrawing?.status === "successful" ? t("news.this-removes-it-from-ndcconnect") : t("news.it-won-t-be-reviewed") })}</p>
      </Modal>
    </div>
  );
}
