/** /states/:state — everything public about one state (spec 12 §4.4). */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, useToast } from "../../components/ui";
import { CandidatePostItem } from "../../posts/CandidatePostItem";
import { SourceBadges } from "../../news/SourceBadges";
import { articlePath } from "../../news/types";
import { formatDate } from "../../lib/format";
import { CandidateGrid } from "../../search/CandidateGrid";
import type { StateDetail } from "../../search/types";
import "../../news/news.css";
import "../../search/search.css";

function NotFound() {
  return (
    <div className="page-shell">
      <EmptyState title="Page not found" action={<Button href="/states">All states</Button>}>That state doesn’t exist.</EmptyState>
    </div>
  );
}

export default function StatePage() {
  const { state = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const { me, setMe } = useMe();
  const res = useRequest(`state:${state}`, (signal) => api<StateDetail>(`/states/${encodeURIComponent(state)}/`, { anonymous: true, signal }));
  const [saving, setSaving] = useState(false);
  const d = res.data;
  useEffect(() => {
    document.title = d ? `${d.label} | NDCConnect` : "State | NDCConnect";
  }, [d]);

  if ((res.error as ApiError | null)?.status === 404) return <NotFound />;
  if (res.error) return <div className="states-page"><Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner></div>;
  if (!d) return <div className="states-page"><Skeleton width="100%" height={300} /></div>;

  const makeMine = async () => {
    setSaving(true);
    try {
      const updated = await api<typeof me>("/me/", { method: "PATCH", body: { home_state: d.state } });
      if (updated) setMe(updated);
      toast.show({ tone: "success", message: `${d.label} is now your state. Only you can see this.` });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save." });
    } finally {
      setSaving(false);
    }
  };
  const isMine = me?.home_state === d.state;
  const filter = (p: string) => (p === "president" ? "/candidates?position=president" : `/candidates?state=${d.state}&position=${p}`);
  return (
    <div className="states-page">
      <p className="article-back"><Link to="/states">← All states</Link></p>
      <header className="state-head">
        <h1>{d.label} on NDCConnect</h1>
        <span className="article-badges">
          <Button variant="secondary" href={`/search?state=${d.state}`}>Search this state</Button>
          {me ? (isMine ? <span className="news-meta">Your state</span>
            : <Button variant="secondary" loading={saving} onClick={() => void makeMine()}>Make this my state</Button>)
            : <Button variant="ghost" href={`/sign-in?redirect_url=${encodeURIComponent(`/states/${d.state}`)}`}>Sign in to make this your state</Button>}
        </span>
      </header>

      <section className="search-section" aria-labelledby="st-c">
        <h2 id="st-c">Candidates{d.election_year ? ` for ${d.election_year}` : ""}</h2>
        {d.groups.length === 0 ? <p className="news-meta">No published candidates for {d.label} yet.</p> : d.groups.map((g) => (
          <div key={g.position} className="state-group">
            <div className="search-section__head">
              <h3>{g.label}</h3>
              {g.total > g.results.length && <Link to={filter(g.position)}>See all {g.total}</Link>}
            </div>
            <CandidateGrid items={g.results} />
          </div>
        ))}
      </section>

      <section className="search-section" aria-labelledby="st-n">
        <div className="search-section__head"><h2 id="st-n">Latest news</h2><Link to={`/news?state=${d.state}`}>All news for {d.label}</Link></div>
        {d.news.length === 0 ? <p className="news-meta">No news yet.</p> : (
          <ul className="news-list">
            {d.news.map((a) => (
              <li key={a.id} className="news-item">
                <div className="news-item__body">
                  <SourceBadges a={{ ...a, pinned: false }} />
                  <h3><Link to={articlePath(a)}>{a.title}</Link></h3>
                  <p className="news-meta">{a.published_at ? formatDate(a.published_at) : ""}{a.state_label ? ` · ${a.state_label}` : " · All of Nigeria"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="search-section" aria-labelledby="st-p">
        <div className="search-section__head"><h2 id="st-p">Latest from candidates</h2>
          <Link to={`/news?source=candidate&state=${d.state}`}>All candidate posts for {d.label}</Link></div>
        {d.posts.length === 0 ? <p className="news-meta">No candidate posts yet.</p> : (
          <ul className="news-list">{d.posts.map((p) => <CandidatePostItem key={p.id} post={p} candidate={p.candidate} />)}</ul>
        )}
      </section>
    </div>
  );
}
