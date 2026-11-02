/** One candidate post in a list (profile Posts tab, /news). Always "Posted by [Candidate]" — never Official (spec 09 §3.4). */
import { Link } from "react-router-dom";
import { AttributionBadge } from "../components/ui";
import { formatDate } from "../lib/format";
import { ArticleImage } from "../news/ArticleImage";
import { KindBadge } from "./KindBadge";
import { postPath, type PostCandidate, type PostSummary } from "./types";
import "./posts.css";

export function CandidatePostItem({ post, candidate, showAttribution = true }: { post: PostSummary; candidate: PostCandidate; showAttribution?: boolean }) {
  return (
    <li className="news-item post-item">
      <div className="news-item__body">
        <span className="article-badges">
          {showAttribution && (
            <AttributionBadge source="candidate" candidateName={candidate.full_name} avatarSrc={candidate.photo?.url_200 ?? undefined}
              verified={candidate.verified} />
          )}
          <KindBadge kind={post.kind} label={post.kind_label} />
        </span>
        <h2><Link to={postPath(candidate.slug, post.id)}>{post.title}</Link></h2>
        <p className="news-meta">{formatDate(post.published_at)}{post.edited_at ? " · Edited" : ""}</p>
        <p>{post.excerpt}</p>
      </div>
      {post.image && <ArticleImage image={post.image} thumb />}
    </li>
  );
}
