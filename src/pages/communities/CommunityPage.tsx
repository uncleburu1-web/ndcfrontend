/**
 * /communities/<path> and /communities/<path>/posts/<id> — spec 17 §6, §14. One route for both: the path is a community's
 * own (national, lagos, lagos/ikeja, lagos/ikeja/05, lagos/ikeja/05/001). Feeds are newest first with pinned announcements.
 */
import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { Composer } from "../../communities/Composer";
import { PostCard } from "../../communities/PostCard";
import { UpcomingStrip } from "../../events/UpcomingStrip";
import type { CommentPage, CommunityComment, CommunityDetail, CommunityPost, Feed } from "../../communities/types";
import { LEVEL_WORDS, communityHref } from "../../communities/types";
import "../../communities/communities.css";
import "../../news/news.css";

function Header({ c }: { c: CommunityDetail }) {
  return (
    <header className="comm-head">
      <nav aria-label="Community levels">
        <ol className="comm-crumbs">
          <li><Link to="/communities">Communities</Link></li>
          {c.breadcrumb.map((b) => <li key={b.id}><Link to={communityHref(b.path)}>{b.name}</Link></li>)}
        </ol>
      </nav>
      <h1>{c.name}</h1>
      <div className="comm-head__meta">
        <span className="comm-level">{LEVEL_WORDS[c.level]}</span>
        <span>{c.members} members</span>
        <Link to="/rules">Community rules</Link>
        {c.membership && <span>You’re a member · {c.membership.how_label}</span>}
      </div>
      {!c.active && <Banner tone="warning">This community has closed. Its posts are read-only.</Banner>}
      {!c.posting_open && <Banner tone="info">Posting is paused in this community.</Banner>}
    </header>
  );
}

function Locked({ c, signedIn }: { c: CommunityDetail; signedIn: boolean }) {
  const here = encodeURIComponent(communityHref(c.path));
  if (!signedIn) {
    return (
      <EmptyState icon="lock" title="Sign in to read this community" action={<Button href={`/sign-in?redirect_url=${here}`}>Sign in</Button>}>
        Community posts are for signed-in members.
      </EmptyState>
    );
  }
  return (
    <EmptyState icon="lock" title="Only members can read this community"
      action={c.post_block?.code === "verification_required" ? <Button href="/pvc">Verify your PVC</Button> : <Button href="/communities">Your communities</Button>}>
      {c.level === "national" || c.level === "state" ? "Join from Communities." :
        "LGA, ward and polling unit communities are for verified voters registered there. We place you automatically once your PVC is verified."}
    </EmptyState>
  );
}

function FeedView({ c }: { c: CommunityDetail }) {
  const api = useApi();
  const [pages, setPages] = useState<Feed[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const first = useRequest(`community-feed:${c.id}`, (signal) => api<Feed>(`/communities/${c.id}/posts/`, { signal }));
  useEffect(() => { if (first.data) setPages([first.data]); }, [first.data]);
  const posts = pages.flatMap((p) => p.results);
  const pinned = pages[0]?.pinned ?? [];
  const next = pages[pages.length - 1]?.next;
  const setPost = (id: string, nextItem: CommunityPost | null) =>
    setPages((ps) => ps.map((p) => ({ ...p, results: p.results.map((x) => (x.id === id && nextItem ? nextItem : x)) })));
  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const url = new URL(next);
      const page = await api<Feed>(`/communities/${c.id}/posts/${url.search}`);
      setPages((ps) => [...ps, page]);
    } finally {
      setLoadingMore(false);
    }
  };
  if (first.error) return <Banner tone="error">{first.error.message}</Banner>;
  if (!first.data) return <Skeleton width="100%" height={240} />;
  return (
    <>
      {c.can_post ? (
        <Composer<CommunityPost> path={`/communities/${c.id}/posts/`} kind="post" campaigns={c.campaigns as { id: string; name: string }[]}
          onPosted={(p) => setPages((ps) => (ps.length ? [{ ...ps[0], results: [p, ...ps[0].results] }, ...ps.slice(1)] : ps))} />
      ) : c.post_block && c.post_block.code !== "not_authenticated" ? (
        <Banner tone="info">{c.post_block.message}{c.post_block.until ? ` (until ${formatDate(c.post_block.until, { withTime: true })})` : ""}</Banner>
      ) : null}
      {pinned.map((a) => (
        <div className="comm-pinned" key={a.id}>
          <span className="comm-pinned__chip">Pinned · {a.category_label}</span>
          <h2><Link to={`/news/official/${a.id}`}>{a.title}</Link></h2>
          <p className="news-meta">For: {a.audience.name} · {formatDate(a.published_at)}</p>
        </div>
      ))}
      {c.level !== "national" && <UpcomingStrip query={`community=${c.id}`} title="Upcoming events here" more={`/events?state=${c.state}`} />}
      {posts.length === 0 ? <EmptyState title="No posts yet">Start the conversation.</EmptyState> : (
        <ul className="comm-feed">
          {posts.map((p) => <li key={p.id}><PostCard item={p} kind="post" communityPath={c.path} showCommentsLink
            onChange={(x) => setPost(p.id, x as CommunityPost | null)} /></li>)}
        </ul>
      )}
      {next && <Button variant="secondary" onClick={() => void more()} loading={loadingMore}>Load more</Button>}
    </>
  );
}

function PostView({ c, postId }: { c: CommunityDetail; postId: string }) {
  const api = useApi();
  const post = useRequest(`community-post:${postId}`, (signal) => api<CommunityPost>(`/community-posts/${postId}/`, { signal }));
  const comments = useRequest(`community-comments:${postId}`, (signal) => api<CommentPage>(`/community-posts/${postId}/comments/`, { signal }));
  const [p, setP] = useState<CommunityPost | null>(null);
  const [list, setList] = useState<CommunityComment[]>([]);
  useEffect(() => { setP(post.data); }, [post.data]);
  useEffect(() => { setList(comments.data?.results ?? []); }, [comments.data]);
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && list.length) document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [list.length]);
  if (post.error) {
    return <EmptyState title="Post not found" action={<Button href={communityHref(c.path)}>Back to {c.name}</Button>}>It may have been deleted.</EmptyState>;
  }
  if (!p) return <Skeleton width="100%" height={200} />;
  return (
    <>
      <p className="article-back"><Link to={communityHref(c.path)}>← {c.name}</Link></p>
      <PostCard item={p} kind="post" communityPath={c.path} onChange={(x) => setP(x as CommunityPost)} />
      <section aria-labelledby="comments-h">
        <h2 id="comments-h">{p.comment_count} comment{p.comment_count === 1 ? "" : "s"}</h2>
        {list.length > 0 && (
          <ul className="comm-comments">
            {list.map((x) => <li key={x.id}><PostCard item={x} kind="comment" communityPath={c.path}
              onChange={(n) => setList((l) => l.map((y) => (y.id === x.id && n ? (n as CommunityComment) : y)))} /></li>)}
          </ul>
        )}
        {p.status === "published" && c.can_post && (
          <Composer<CommunityComment> path={`/community-posts/${p.id}/comments/`} kind="comment" campaigns={c.campaigns as { id: string; name: string }[]}
            onPosted={(x) => { setList((l) => [...l, x]); setP({ ...p, comment_count: p.comment_count + 1 }); }} />
        )}
        {p.status === "published" && !c.can_post && c.post_block && <Banner tone="info">{c.post_block.message}</Banner>}
      </section>
    </>
  );
}

export default function CommunityPage() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const splat = useParams()["*"] ?? "";
  const { path, postId } = useMemo(() => {
    const m = splat.replace(/\/+$/, "").match(/^(.*?)\/posts\/([0-9a-f-]{36})$/i);
    return m ? { path: m[1], postId: m[2] } : { path: splat.replace(/\/+$/, ""), postId: "" };
  }, [splat]);
  const res = useRequest(`community:${path}:${isSignedIn ? 1 : 0}`, (signal) =>
    api<CommunityDetail>(`/communities/lookup/?path=${encodeURIComponent(path)}`, { signal, anonymous: !isSignedIn }));
  const c = res.data;
  useEffect(() => { document.title = c ? `${c.name} | NDCConnect` : "Community | NDCConnect"; }, [c]);

  if (res.error) {
    return <div className="comm-page"><EmptyState title="Community not found" action={<Button href="/communities">All communities</Button>}>
      The link may be wrong, or the community has closed.</EmptyState></div>;
  }
  if (!c) return <div className="comm-page" aria-busy="true"><Skeleton width="60%" height={36} /><Skeleton width="100%" height={240} /></div>;
  return (
    <div className="comm-page">
      <Header c={c} />
      {!c.can_read ? <Locked c={c} signedIn={Boolean(isSignedIn)} /> : postId ? <PostView c={c} postId={postId} /> : <FeedView c={c} />}
    </div>
  );
}
