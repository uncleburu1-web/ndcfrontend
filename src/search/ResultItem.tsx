/** Article and candidate-post rows for search (spec 12 §4.2), with matches marked. Attribution always in words. */
import { Link } from "react-router-dom";
import { AttributionBadge } from "../components/ui";
import { formatDate } from "../lib/format";
import { SourceBadges } from "../news/SourceBadges";
import { KindBadge } from "../posts/KindBadge";
import { Highlight } from "./Highlight";
import type { ArticleHit, PostHit } from "./types";
import "../news/news.css";
import "./search.css";
import { t } from "../i18n";

export function ArticleResult({ a }: { a: ArticleHit }) {
  return (
    <li className="news-item search-item">
      <div className="news-item__body">
        <SourceBadges a={{ ...a, pinned: false }} />
        <h3><Link to={a.url}><Highlight text={a.title} ranges={a.title_matches} /></Link></h3>
        <p className="news-meta">
          {a.published_at ? formatDate(a.published_at) : ""}
          {a.state_label ? ` · ${a.state_label}` : t("search.all-of-nigeria")}
          {a.source === "community" ? t("search.by", { v: a.byline ?? t("search.a-member") }) : ""}
        </p>
        <p className="search-snippet"><Highlight text={a.snippet || a.excerpt} ranges={a.snippet ? a.matches : []} /></p>
      </div>
    </li>
  );
}

export function PostResult({ p }: { p: PostHit }) {
  return (
    <li className="news-item search-item">
      <div className="news-item__body">
        <span className="article-badges">
          <AttributionBadge source="candidate" candidateName={p.candidate.full_name} avatarSrc={p.candidate.photo?.url_200 ?? undefined}
            verified={p.candidate.verified} />
          <KindBadge kind={p.kind} label={p.kind_label} />
        </span>
        <h3><Link to={p.url}><Highlight text={p.title} ranges={p.title_matches} /></Link></h3>
        <p className="news-meta">{formatDate(p.published_at)}{p.state_label ? ` · ${p.state_label}` : ""}</p>
        <p className="search-snippet"><Highlight text={p.snippet || p.excerpt} ranges={p.snippet ? p.matches : []} /></p>
      </div>
    </li>
  );
}
