/**
 * /candidates/:slug — public candidate profile (spec 03 §8.2).
 * Unknown or unpublished candidates show the same not-found page.
 */
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import type { CandidateProfile } from "../../candidates/types";
import { useRequest } from "../../candidates/useRequest";
import { donationsEnabled } from "../../config";
import { CandidateVote } from "../../follows/CandidateVote";
import { useFollows } from "../../follows/FollowProvider";
import { Avatar, Banner, Button, DonateButton, EmptyState, Icon, Skeleton } from "../../components/ui";
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

export default function CandidateProfilePage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const { data: c, error, loading, retry } = useRequest(`candidate:${slug}`, (signal) =>
    api<CandidateProfile>(`/candidates/${encodeURIComponent(slug)}/`, { anonymous: true, signal })
  );

  const { loadStates } = useFollows();
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
          <Avatar name={c.full_name} src={c.photo?.url_800} size="xl" />
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
              {donationsEnabled && <DonateButton href={`/donate?candidate=${encodeURIComponent(c.slug)}`} />}
            </div>
            <p className="cand-hero__private">Who you follow is private.</p>
          </div>
        </div>
      </header>

      <div className="cand-about">
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
      </div>
    </article>
  );
}
