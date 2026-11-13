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
import { t } from "../../i18n";
import { InLanguage } from "../../i18n/ContentLanguage";

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
    document.title = p ? t("candidates.ndcconnect", { title: p.title, full_name: p.candidate.full_name }) : t("candidates.post-ndcconnect");
  }, [p]);

  const removed = removalFromError(res.error);
  if (removed) return <RemovedNotice notice={removed} back={{ href: `/candidates/${encodeURIComponent(slug)}`, label: t("candidates.back-to-the-profile") }} />;
  if (res.error) {
    return (
      <div className="page-shell">
        <EmptyState title={t("candidates.post-not-found")} action={<Button href={`/candidates/${encodeURIComponent(slug)}`}>{t("candidates.back-to-the-profile")}</Button>}>
          {t("candidates.it-may-have-been-removed-or")}</EmptyState>
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
      <p className="news-meta">{formatDate(p.published_at)}{p.edited_at ? t("candidates.edited", { formatDate: formatDate(p.edited_at) }) : ""}</p>
      {p.image && <ArticleImage image={p.image} />}
      <InLanguage language={p.language}><ArticleBody body={p.body} /></InLanguage>
      <p className="post-campaign-line">{t("candidates.campaign-content-from-ndcconnect-doesn-t", { full_name: c.full_name })}</p>
      <div className="article-actions">
        <CandidateVote slug={c.slug} name={c.full_name} variant="profile" />
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>{t("candidates.report")}</Button>
        <Link to={`/candidates/${encodeURIComponent(c.slug)}`}>{t("candidates.back-to-the-profile")}</Link>
      </div>
      <ReportDialog path={`/candidates/${encodeURIComponent(c.slug)}/posts/${p.id}/report/`} title={t("candidates.report-this-post")} open={reporting}
        onClose={() => setReporting(false)} />
    </article>
  );
}
