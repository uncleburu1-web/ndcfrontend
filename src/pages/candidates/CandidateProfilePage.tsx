/**
 * /candidates/:slug — public candidate profile (spec 03 §8.2).
 * Unknown or unpublished candidates show the same not-found page.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import type { CandidateProfile } from "../../candidates/types";
import { useRequest } from "../../candidates/useRequest";
import { useDonationConfig } from "../../donations/DonationConfigProvider";
import { CandidateVote } from "../../follows/CandidateVote";
import { useFollows } from "../../follows/FollowProvider";
import { Avatar, Banner, Button, DonateButton, EmptyState, Icon, Pagination, Skeleton, Tabs } from "../../components/ui";
import { CandidatePostItem } from "../../posts/CandidatePostItem";
import { ReportDialog } from "../../news/ReportDialog";
import type { PostSummary } from "../../posts/types";
import "../../news/news.css";
import "./candidates.css";

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </>
  );
}

/** Posts tab (spec 09 §4.2): fetched separately and anonymously; 10 per page. */
function usePosts(slug: string, page: number) {
  const api = useApi();
  return useRequest(`candidate-posts:${slug}:${page}`, (signal) =>
    api<{ count: number; results: PostSummary[] }>(`/candidates/${encodeURIComponent(slug)}/posts/${page > 1 ? `?page=${page}` : ""}`,
      { anonymous: true, signal }));
}

export default function CandidateProfilePage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const { data: c, error, loading, retry } = useRequest(`candidate:${slug}`, (signal) =>
    api<CandidateProfile>(`/candidates/${encodeURIComponent(slug)}/`, { anonymous: true, signal })
  );

  const [tab, setTab] = useState("about");
  const [reporting, setReporting] = useState(false);
  const [postPage, setPostPage] = useState(1);
  const posts = usePosts(slug, postPage);
  const postCount = posts.data?.count ?? 0;
  const { loadStates } = useFollows();
  const donationsOpen = useDonationConfig().config.open;
  useEffect(() => {
    if (c?.slug) loadStates([c.slug]);
  }, [c?.slug, loadStates]);

  useEffect(() => {
    document.title = c ? `${c.full_name} — ${c.position_label} | NDCConnect` : "Candidate | NDCConnect";
  }, [c]);

  if (error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title="Candidate not found" action={<Button href="/candidates">See all candidates</Button>}>
          This profile doesn’t exist or isn’t published.
        </EmptyState>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-shell">
        <Banner tone="error" title="We couldn’t load this candidate" action={<Button variant="secondary" size="sm" onClick={retry}>Try again</Button>}>
          {error.message}
        </Banner>
      </div>
    );
  }
  if (loading || !c) {
    return (
      <div className="cand-hero" aria-busy="true">
        <div className="cand-hero__inner">
          <span className="visually-hidden">Loading candidate</span>
          <Skeleton circle width={160} height={160} />
          <div className="cand-hero__text">
            <Skeleton width="60%" height={36} />
            <Skeleton width="40%" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <article>
      <header className="cand-hero">
        <div className="cand-hero__inner">
          <Avatar name={c.full_name} src={c.photo?.url_800} srcSet={c.photo?.srcset} size="xl" />
          <div className="cand-hero__text">
            <p className="cand-hero__back">
              <Link to="/candidates">All candidates</Link>
            </p>
            <h1 className="cand-hero__name">
              {c.full_name}
              {c.verified && <Icon name="verified" size={26} label="Verified by NDCConnect" className="cand-hero__verified" />}
            </h1>
            <p className="cand-hero__office">{c.position_label}</p>
            <p className="cand-hero__meta">
              {c.area_display} · {c.party} · {c.election_year} elections
            </p>
            <div className="cand-hero__actions">
              <CandidateVote slug={c.slug} name={c.full_name} variant="profile" onGone={retry} />
              {/* Separate action, never a step toward voting (spec 01 §6.2, spec 04 §8.3). */}
              {donationsOpen && <DonateButton href={`/donate?candidate=${encodeURIComponent(c.slug)}`} />}
            </div>
            <p className="cand-hero__private">Who you follow is private.</p>
          </div>
        </div>
      </header>

      {postCount > 0 ? (
        <div className="cand-about">
          <Tabs label={`${c.full_name} sections`} value={tab} onChange={setTab} tabs={[
            { id: "about", label: "About", content: <About c={c} /> },
            { id: "posts", label: `Posts (${postCount})`, content: (
              <div className="cand-posts">
                <ul className="news-list">
                  {posts.data?.results.map((p) => <CandidatePostItem key={p.id} post={p} candidate={c} showAttribution={false} />)}
                </ul>
                <Pagination page={postPage} pageCount={Math.ceil(postCount / 10)} onChange={setPostPage} label="Post pages" />
              </div>
            ) },
          ]} />
        </div>
      ) : (
        <div className="cand-about"><About c={c} /></div>
      )}
      <p className="cand-report">
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>Report a problem with this profile</Button>
      </p>
      <ReportDialog variant="profile" path={`/candidates/${encodeURIComponent(c.slug)}/report/`} title="Report a problem with this profile"
        open={reporting} onClose={() => setReporting(false)} />
    </article>
  );
}

function About({ c }: { c: CandidateProfile }) {
  return (
      <>
        <h2>About {c.full_name.split(" ")[0]}</h2>
        {c.campaign_summary && <p className="cand-about__summary">{c.campaign_summary}</p>}

        {c.priorities.length > 0 && (
          <section aria-labelledby="priorities-title">
            <h3 id="priorities-title">What {c.full_name.split(" ")[0]} will work on</h3>
            <ul className="cand-about__priorities">
              {c.priorities.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        {c.biography && (
          <section aria-labelledby="bio-title">
            <h3 id="bio-title">Biography</h3>
            <div className="cand-about__bio">
              <Paragraphs text={c.biography} />
            </div>
          </section>
        )}

        {c.links.length > 0 && (
          <section aria-labelledby="links-title">
            <h3 id="links-title">Links</h3>
            <ul className="cand-about__links">
              {c.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!c.campaign_summary && !c.priorities.length && !c.biography && !c.links.length && (
          <p className="cand-about__empty">This candidate hasn’t added details yet.</p>
        )}
      </>
  );
}
