/**
 * /people/:handle — a person's public profile (spec 20 §5.1). Only what they chose to show; never who they follow, their
 * communities, membership, PVC details, donations or any count. Not listed or searchable; the API sends `noindex`.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Schema } from "../../api/typed";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Avatar, Button, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { ReportDialog } from "../../news/ReportDialog";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import "../../settings/settings.css";

type Profile = Schema<"PublicProfile">;

function sinceWords(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

/** Search engines are asked not to list the page, as the API's X-Robots-Tag does for the data. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

export default function PublicProfilePage() {
  const { handle = "" } = useParams();
  const api = useApi();
  const [p, setP] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reporting, setReporting] = useState(false);
  useNoIndex();
  useEffect(() => {
    setP(null);
    setMissing(false);
    setFailed(false);
    api<Profile>(`/people/${encodeURIComponent(handle.toLowerCase())}/`, { anonymous: true })
      .then((d) => {
        setP(d);
        document.title = `${d.name} | NDCConnect`;
      })
      .catch((err) => (err instanceof ApiError && err.status === 404 ? setMissing(true) : setFailed(true)));
  }, [api, handle]);

  if (missing) {
    return (
      <div className="page-shell">
        <EmptyState title="This profile isn’t available">
          It may have been turned off, or the link may be wrong. <Link to="/news">Read the news</Link>
        </EmptyState>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="page-shell">
        <EmptyState icon="alert" title="We couldn’t load this profile">Check your connection and try again.</EmptyState>
      </div>
    );
  }
  if (!p) return <div className="page-shell"><Skeleton width="100%" height={240} /></div>;

  const where = p.location ? (p.location.lga ? `${p.location.lga}, ${p.location.state_label}` : p.location.state_label) : "";
  return (
    <article className="people-page">
      <header className="people-head">
        <Avatar name={p.name} src={p.photo_url ?? undefined} size="xl" />
        <div>
          <h1>{p.name}</h1>
          {p.verified_voter && <VerifiedVoterBadge />}
          {where && <p className="set-meta">{where}</p>}
          <p className="set-meta">On NDCConnect since {sinceWords(p.member_since)}</p>
        </div>
      </header>
      {p.bio && <p className="people-bio">{p.bio}</p>}
      {p.news.length > 0 && (
        <section aria-labelledby="people-news-h">
          <h2 id="people-news-h">News they published</h2>
          <ul className="people-news">
            {p.news.map((n) => (
              <li key={n.id}>
                <Link to={`/news/community/${n.id}`}>{n.title}</Link>
                <span className="set-meta"> · {formatDate(n.published_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="people-report">
        <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>Report this profile</Button>
      </p>
      <ReportDialog path={`/people/${p.handle}/report/`} title="Report this profile’s bio or photo" open={reporting} onClose={() => setReporting(false)} />
    </article>
  );
}
