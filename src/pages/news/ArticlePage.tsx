/** /news/official/:id and /news/community/:id — spec 07 §4.2. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { ArticleBody } from "../../news/ArticleBody";
import { ArticleImage } from "../../news/ArticleImage";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import { ReportDialog } from "../../news/ReportDialog";
import { SourceBadges } from "../../news/SourceBadges";
import { RemovedNotice, removalFromError } from "../../moderation/RemovedNotice";
import type { ArticleDetail, ArticleSource } from "../../news/types";
import "../../news/news.css";
import { t, useLanguage } from "../../i18n";
import { InLanguage, languageName } from "../../i18n/ContentLanguage";

export default function ArticlePage({ source }: { source: ArticleSource }) {
  const { id = "" } = useParams();
  const api = useApi();
  const lang = useLanguage();
  // Spec 21 §10: an official announcement in the reader's language when a published version exists (?lang= is part of
  // the cached URL); the reader can switch to any published version.
  const [chosen, setChosen] = useState<string | null>(null);
  const version = chosen ?? (lang === "qps" ? "en" : lang);
  const res = useRequest(`article:${id}:${version}`, (signal) => api<ArticleDetail>(`/news/${id}/?lang=${version}`, { anonymous: true, signal }));
  const [reporting, setReporting] = useState(false);
  const a = res.data && res.data.source === source ? res.data : null;

  useEffect(() => {
    document.title = a ? t("news.ndcconnect-news", { title: a.title }) : t("news.news-ndcconnect");
  }, [a]);

  const removed = removalFromError(res.error);
  if (removed) return <RemovedNotice notice={removed} back={{ href: "/news", label: t("news.back-to-news") }} />;
  if (res.error || (res.data && !a)) {
    return (
      <div className="page-shell">
        <EmptyState title={t("news.article-not-found")} action={<Button href="/news">{t("news.back-to-news")}</Button>}>
          {t("news.it-may-have-been-removed-or")}</EmptyState>
      </div>
    );
  }
  if (!a) return <div className="article-page" aria-busy="true"><Skeleton width="80%" height={36} /><Skeleton width="100%" height={200} /></div>;

  return (
    <article className="article-page">
      <p className="article-back"><Link to="/news">{t("news.news")}</Link></p>
      <SourceBadges a={{ ...a, pinned: false }} />
      {a.translations && a.translations.length > 0 && (
        <nav className="news-versions" aria-label={t("news.versions")}>
          {[a.language ?? "und", ...a.translations.map((v) => v.language)].map((code) => {
            const current = (a.version_language ?? a.language) === code;
            return (
              <Button key={code} size="sm" variant={current ? "primary" : "secondary"} aria-pressed={current} onClick={() => setChosen(code)}>
                <span lang={code === "und" ? undefined : code}>{languageName(code)}</span>
              </Button>
            );
          })}
        </nav>
      )}
      {a.version_out_of_date && <Banner tone="info">{t("news.version-out-of-date")}</Banner>}
      <InLanguage language={a.version_language ?? a.language} as="h1" label={false}>{a.title}</InLanguage>
      <p className="news-meta">
        {a.source === "community" && <>{t.rich("news.by", { x1: a.byline && a.byline_profile ? <Link to={`/people/${a.byline_profile}`}>{a.byline}</Link> : a.byline ?? t("news.a-member"), x2: a.byline_verified && <> <VerifiedVoterBadge size="sm" /></> })}</>}
        {a.published_at ? formatDate(a.published_at) : ""}
        {a.edited_at ? t("news.updated", { formatDate: formatDate(a.edited_at) }) : ""}
        {a.state_label ? ` · ${a.state_label}` : ""}
      </p>
      {a.audience && <p className="news-meta">{t.rich("news.for-community", { name: a.audience.name, link: (chunks) => <Link to={`/communities/${a.audience!.path}`}>{chunks}</Link> })}</p>}
      {a.image && <ArticleImage image={a.image} alt="" />}
      <InLanguage language={a.version_language ?? a.language}><ArticleBody body={a.body} /></InLanguage>
      {(a.source_url || a.source_name) && (
        <p className="article-source">
          {t.rich("news.source", { x1: a.source_name && <>{a.source_name}{a.source_url ? " — " : ""}</>, x2: a.source_url && <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow ugc">{a.source_url}</a> })}
        </p>
      )}
      {a.source === "community" && (
        <p className="article-disclaimer">
          {t("news.community-news-is-written-by-ndcconnect")}</p>
      )}
      <div className="article-actions">
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>{t("news.report")}</Button>
        <Link to="/news">{t("news.back-to-news")}</Link>
      </div>
      <ReportDialog articleId={a.id} title={a.source === "official" ? t("news.report-this-announcement") : t("news.report-this-article")} open={reporting}
        onClose={() => setReporting(false)} />
    </article>
  );
}
