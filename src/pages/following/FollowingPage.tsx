/**
 * /following — everyone the signed-in user follows (spec 04 §4.4).
 * Sign-in only: no profile completion, no PVC. Unpublished/archived candidates are
 * hidden here (but their follows are kept, and come back if republished).
 */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Avatar, Banner, Button, EmptyState, Pagination, Skeleton } from "../../components/ui";
import { CandidateVote } from "../../follows/CandidateVote";
import { useFollows } from "../../follows/FollowProvider";
import type { FollowPage } from "../../follows/types";
import "./following.css";

const PAGE_SIZE = 20;

export default function FollowingPage() {
  const api = useApi();
  const f = useFollows();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const res = useRequest(`following:${page}`, (signal) => api<FollowPage>(`/me/follows/${page > 1 ? `?page=${page}` : ""}`, { signal }));

  useEffect(() => {
    document.title = "Following | NDCConnect";
  }, []);
  const { seed } = f;
  useEffect(() => {
    if (res.data) seed(res.data.results);
  }, [res.data, seed]);

  // Rows unfollowed on this page (or elsewhere in this session) drop out straight away.
  const rows = res.data?.results.filter((r) => f.stateOf(r.candidate.slug) !== null) ?? [];
  const hidden = res.data?.hidden_count ?? 0;

  return (
    <div className="following-page">
      <header className="following-page__head">
        <h1>Following</h1>
        <p className="following-page__lead">
          Candidates you’ve voted for (followed). Only you can see this list. Turn on the bell to be notified when a candidate posts.
        </p>
      </header>

      {res.error ? (
        <Banner tone="error" title="We couldn’t load who you follow" action={<Button variant="secondary" size="sm" onClick={res.retry}>Try again</Button>}>
          {res.error.message}
        </Banner>
      ) : res.loading && !res.data ? (
        <div aria-busy="true">
          <span className="visually-hidden">Loading who you follow</span>
          <ul className="following-list">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="following-row">
              <Skeleton circle width={56} height={56} />
              <div className="following-row__text">
                <Skeleton width="50%" height={20} />
                <Skeleton width="35%" />
              </div>
            </li>
          ))}
          </ul>
        </div>
      ) : res.data && rows.length === 0 && res.data.count === 0 ? (
        <EmptyState title="You’re not following anyone yet." action={<Button href="/candidates">Browse candidates</Button>}>
          Tap Vote on a candidate’s profile to follow them. It’s free.
        </EmptyState>
      ) : res.data ? (
        <>
          {rows.length === 0 ? (
            <EmptyState title="You’re not following anyone on this page any more." action={<Button href="/candidates">Browse candidates</Button>}>
              Candidates you unfollow disappear from this list.
            </EmptyState>
          ) : (
            <ul className="following-list">
              {rows.map((r) => (
                <li key={r.candidate.slug} className="following-row">
                  <Avatar name={r.candidate.full_name} src={r.candidate.photo?.url_200} size="md" />
                  <div className="following-row__text">
                    <Link to={`/candidates/${r.candidate.slug}`} className="following-row__name">
                      {r.candidate.full_name}
                    </Link>
                    <p className="following-row__meta">
                      {r.candidate.position_label} · {r.candidate.area_display}
                    </p>
                  </div>
                  <div className="following-row__actions">
                    <CandidateVote slug={r.candidate.slug} name={r.candidate.full_name} variant="following" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={page}
            pageCount={Math.ceil(res.data.count / PAGE_SIZE)}
            onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})}
            label="Following pages"
          />
          {hidden > 0 && <p className="following-page__hidden">Some candidates you followed are no longer listed.</p>}
        </>
      ) : null}
    </div>
  );
}
