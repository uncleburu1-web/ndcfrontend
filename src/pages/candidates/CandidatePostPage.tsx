/** /candidates/:slug/posts/:id — one candidate post (spec 09 §4.2). Public; campaign content, never Official. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { AttributionBadge, Button, EmptyState, Skeleton } from "../../components/ui";
import { CandidateVote } from "../../follows/CandidateVote";
import { useFollows } from "../../follows/FollowProvider";
import { formatDate } from "../../lib/format";
import { ArticleBody } from "../../news/ArticleBody";
import { ArticleImage } from "../../news/ArticleImage";
import { ReportDialog } from "../../news/ReportDialog";
import { KindBadge } from "../../posts/KindBadge";
import { RemovedNotice, removalFromError } from "../../moderation/RemovedNotice";
import type { PostDetail } from "../../posts/types";
import "../../news/news.css";
import "../../posts/posts.css";

export default function CandidatePostPage() {
  const { slug = "", id = "" } = useParams();
  const api = useApi();
  const res = useRequest(`candidate-post:${slug}:${id}`, (signal) =>
    api<PostDetail>(`/candidates/${encodeURIComponent(slug)}/posts/${id}/`, { anonymous: true, signal }));
  const [reporting, setReporting] = useState(false);
  const { loadStates } = useFollows();
  const p = res.data;

  useEffect(() => {
    if (p) loadStates([p.candidate.slug]);
  }, [p, loadStates]);
  useEffect(() => {
    document.title = p ? `${p.title} — ${p.candidate.full_name} | NDCConnect` : "Post | NDCConnect";
  }, [p]);

  const removed = removalFromError(res.error);
  if (removed) return <RemovedNotice notice={removed} back={{ href: `/candidates/${encodeURIComponent(slug)}`, label: "Back to the profile" }} />;
  if (res.error) {
    return (
      <div className="page-shell">
        <EmptyState title="Post not found" action={<Button href={`/candidates/${encodeURIComponent(slug)}`}>Back to the profile</Button>}>
          It may have been removed, or the link is wrong.
        </EmptyState>
      </div>
    );
  }
  if (!p) return <div className="article-page" aria-busy="true"><Skeleton width="80%" height={36} /><Skeleton width="100%" height={200} /></div>;

  const c = p.candidate;
  return (
    <article className="article-page">
      <p className="article-back"><Link to={`/candidates/${encodeURIComponent(c.slug)}`}>← {c.full_name}</Link></p>
      <span className="article-badges">
        <AttributionBadge source="candidate" candidateName={c.full_name} avatarSrc={c.photo?.url_200 ?? undefined} verified={c.verified} />
        <KindBadge kind={p.kind} label={p.kind_label} />
      </span>
      <h1>{p.title}</h1>
      <p className="news-meta">{formatDate(p.published_at)}{p.edited_at ? ` · Edited ${formatDate(p.edited_at)}` : ""}</p>
      {p.image && <ArticleImage image={p.image} />}
      <ArticleBody body={p.body} />
      <p className="post-campaign-line">Campaign content from {c.full_name}. NDCConnect doesn’t write or endorse candidate posts.</p>
      <div className="article-actions">
        <CandidateVote slug={c.slug} name={c.full_name} variant="profile" />
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>Report</Button>
        <Link to={`/candidates/${encodeURIComponent(c.slug)}`}>Back to the profile</Link>
      </div>
      <ReportDialog path={`/candidates/${encodeURIComponent(c.slug)}/posts/${p.id}/report/`} title="Report this post" open={reporting}
        onClose={() => setReporting(false)} />
    </article>
  );
}
