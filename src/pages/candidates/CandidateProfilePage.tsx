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
import { UpcomingStrip } from "../../events/UpcomingStrip";
import { CandidatePostItem } from "../../posts/CandidatePostItem";
import { ReportDialog } from "../../news/ReportDialog";
import type { PostSummary } from "../../posts/types";
import "../../news/news.css";
import "./candidates.css";
import { t } from "../../i18n";
import { InLanguage } from "../../i18n/ContentLanguage";

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
  const volunteering = useRequest(`volunteering-open:${slug}`, (signal) =>  // spec 18 §9.1: the button shows while it's open
    api<{ open: boolean }>(`/candidates/${encodeURIComponent(slug)}/volunteering/`, { anonymous: true, signal }).catch(() => ({ open: false })));
  useEffect(() => {
    if (c?.slug) loadStates([c.slug]);
  }, [c?.slug, loadStates]);

  useEffect(() => {
    document.title = c ? t("candidates.ndcconnect-2", { full_name: c.full_name, position_label: c.position_label }) : t("candidates.candidate-ndcconnect");
  }, [c]);

  if (error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title={t("candidates.candidate-not-found")} action={<Button href="/candidates">{t("candidates.see-all-candidates")}</Button>}>
          {t("candidates.this-profile-doesn-t-exist-or")}</EmptyState>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-shell">
        <Banner tone="error" title={t("candidates.we-couldn-t-load-this-candidate")} action={<Button variant="secondary" size="sm" onClick={retry}>{t("candidates.try-again")}</Button>}>
          {error.message}
        </Banner>
      </div>
    );
  }
  if (loading || !c) {
    return (
      <div className="cand-hero" aria-busy="true">
        <div className="cand-hero__inner">
          <span className="visually-hidden">{t("candidates.loading-candidate")}</span>
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
              <Link to="/candidates">{t("candidates.all-candidates")}</Link>
            </p>
            <h1 className="cand-hero__name">
              {c.full_name}
              {c.verified && <Icon name="verified" size={26} label={t("candidates.verified-by-ndcconnect")} className="cand-hero__verified" />}
            </h1>
            <p className="cand-hero__office">{c.position_label}</p>
            <p className="cand-hero__meta">
              {t("candidates.elections", { area_display: c.area_display, party: c.party, election_year: c.election_year })}</p>
            <div className="cand-hero__actions">
              <CandidateVote slug={c.slug} name={c.full_name} variant="profile" onGone={retry} />
              {/* Separate action, never a step toward voting (spec 01 §6.2, spec 04 §8.3). */}
              {donationsOpen && <DonateButton href={`/donate?candidate=${encodeURIComponent(c.slug)}`} />}
              {volunteering.data?.open && <Button variant="secondary" href={`/candidates/${encodeURIComponent(c.slug)}/volunteer`}>{t("candidates.volunteer-for", { full_name: c.full_name })}</Button>}
            </div>
            <p className="cand-hero__private">{t("candidates.who-you-follow-is-private")}</p>
          </div>
        </div>
      </header>

      <div className="cand-about"><UpcomingStrip query={`candidate=${encodeURIComponent(c.slug)}`} title={t("candidates.events")} limit={5}
        more={`/events?candidate=${encodeURIComponent(c.slug)}`} /></div>
      {postCount > 0 ? (
        <div className="cand-about">
          <Tabs label={t("candidates.sections", { full_name: c.full_name })} value={tab} onChange={setTab} tabs={[
            { id: "about", label: t("candidates.about"), content: <About c={c} /> },
            { id: "posts", label: t("candidates.posts", { postCount }), content: (
              <div className="cand-posts">
                <ul className="news-list">
                  {posts.data?.results.map((p) => <CandidatePostItem key={p.id} post={p} candidate={c} showAttribution={false} />)}
                </ul>
                <Pagination page={postPage} pageCount={Math.ceil(postCount / 10)} onChange={setPostPage} label={t("candidates.post-pages")} />
              </div>
            ) },
          ]} />
        </div>
      ) : (
        <div className="cand-about"><About c={c} /></div>
      )}
      <p className="cand-report">
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>{t("candidates.report-a-problem-with-this-profile")}</Button>
      </p>
      <ReportDialog variant="profile" path={`/candidates/${encodeURIComponent(c.slug)}/report/`} title={t("candidates.report-a-problem-with-this-profile")}
        open={reporting} onClose={() => setReporting(false)} />
    </article>
  );
}

function About({ c }: { c: CandidateProfile }) {
  return (
      <>
        <h2>{t("candidates.about-2", { v: c.full_name.split(" ")[0] })}</h2>
        {c.campaign_summary && <p className="cand-about__summary">{c.campaign_summary}</p>}

        {c.priorities.length > 0 && (
          <section aria-labelledby="priorities-title">
            <h3 id="priorities-title">{t("candidates.what-will-work-on", { v: c.full_name.split(" ")[0] })}</h3>
            <ul className="cand-about__priorities">
              {c.priorities.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        {c.biography && (
          <section aria-labelledby="bio-title">
            <h3 id="bio-title">{t("candidates.biography")}</h3>
            <InLanguage language={(c as { biography_language?: string }).biography_language} className="cand-about__bio">
              <Paragraphs text={c.biography} />
            </InLanguage>
          </section>
        )}

        {c.links.length > 0 && (
          <section aria-labelledby="links-title">
            <h3 id="links-title">{t("candidates.links")}</h3>
            <ul className="cand-about__links">
              {c.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label}
                    <span className="visually-hidden"> {t("candidates.opens-in-a-new-tab")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!c.campaign_summary && !c.priorities.length && !c.biography && !c.links.length && (
          <p className="cand-about__empty">{t("candidates.this-candidate-hasn-t-added-details")}</p>
        )}
      </>
  );
}
