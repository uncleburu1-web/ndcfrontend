/** /news/official/:id and /news/community/:id — spec 07 §4.2. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { ArticleBody } from "../../news/ArticleBody";
import { ArticleImage } from "../../news/ArticleImage";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import { ReportDialog } from "../../news/ReportDialog";
import { SourceBadges } from "../../news/SourceBadges";
import type { ArticleDetail, ArticleSource } from "../../news/types";
import "../../news/news.css";

export default function ArticlePage({ source }: { source: ArticleSource }) {
  const { id = "" } = useParams();
  const api = useApi();
  const res = useRequest(`article:${id}`, (signal) => api<ArticleDetail>(`/news/${id}/`, { anonymous: true, signal }));
  const [reporting, setReporting] = useState(false);
  const a = res.data && res.data.source === source ? res.data : null;

  useEffect(() => {
    document.title = a ? `${a.title} | NDCConnect News` : "News | NDCConnect";
  }, [a]);

  if (res.error || (res.data && !a)) {
    return (
      <div className="page-shell">
        <EmptyState title="Article not found" action={<Button href="/news">Back to News</Button>}>
          It may have been removed, or the link is wrong.
        </EmptyState>
      </div>
    );
  }
  if (!a) return <div className="article-page" aria-busy="true"><Skeleton width="80%" height={36} /><Skeleton width="100%" height={200} /></div>;

  return (
    <article className="article-page">
      <p className="article-back"><Link to="/news">← News</Link></p>
      <SourceBadges a={{ ...a, pinned: false }} />
      <h1>{a.title}</h1>
      <p className="news-meta">
        {a.source === "community" && <>by {a.byline ?? "a member"}{a.byline_verified && <> <VerifiedVoterBadge size="sm" /></>} · </>}
        {a.published_at ? formatDate(a.published_at) : ""}
        {a.edited_at ? ` · Updated ${formatDate(a.edited_at)}` : ""}
        {a.state_label ? ` · ${a.state_label}` : ""}
      </p>
      {a.image && <ArticleImage image={a.image} alt="" />}
      <ArticleBody body={a.body} />
      {(a.source_url || a.source_name) && (
        <p className="article-source">
          Source: {a.source_name && <>{a.source_name}{a.source_url ? " — " : ""}</>}
          {a.source_url && <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow ugc">{a.source_url}</a>}
        </p>
      )}
      {a.source === "community" && (
        <p className="article-disclaimer">
          Community news is written by NDCConnect members and checked by our reviewers before it appears. It isn’t an official NDC statement.
        </p>
      )}
      <div className="article-actions">
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>Report</Button>
        <Link to="/news">Back to News</Link>
      </div>
      <ReportDialog articleId={a.id} open={reporting} onClose={() => setReporting(false)} />
    </article>
  );
}
