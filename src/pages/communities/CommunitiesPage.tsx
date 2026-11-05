/**
 * /communities — spec 17 §14: your communities, joining (consent), the not-verified banner, choosing a state, browse.
 * Who belongs where is never shown; counts are banded.
 */
import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Select, Skeleton, useToast } from "../../components/ui";
import { STATES } from "../../lib/nigeria";
import type { Community, MyCommunities } from "../../communities/types";
import { LEVEL_WORDS, communityHref } from "../../communities/types";
import "../../communities/communities.css";

export function CommunityCards({ items }: { items: Community[] }) {
  return (
    <ul className="comm-cards">
      {items.map((c) => (
        <li key={c.id}>
          <Link className="comm-card" to={communityHref(c.path)}>
            <span className="comm-card__name">{c.name}</span>
            <span className="comm-card__meta">{LEVEL_WORDS[c.level]} · {c.members} members</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function YourCommunities({ me, onChange }: { me: MyCommunities; onChange: (m: MyCommunities) => void }) {
  const api = useApi();
  const toast = useToast();
  const [state, setState] = useState("");
  const [busy, setBusy] = useState("");
  const hasState = me.memberships.some((m) => m.level === "state");
  const run = async (label: string, fn: () => Promise<MyCommunities>, done: string) => {
    setBusy(label);
    try {
      onChange(await fn());
      toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work. Try again." });
    } finally {
      setBusy("");
    }
  };
  if (!me.consented) {
    return (
      <section className="adm-panel" aria-labelledby="join-h">
        <h2 id="join-h">Join your communities</h2>
        <p>Discuss politics with people in your state, LGA, ward and polling unit. Nobody can see who is in a community; your posts show your
          first name and last initial.</p>
        <Button loading={busy === "join"} onClick={() => void run("join", () => api<MyCommunities>("/me/communities/join/", { method: "POST" }),
          "You’ve joined.")}>Join communities</Button>
      </section>
    );
  }
  return (
    <section aria-labelledby="yours-h">
      <h2 id="yours-h">Your communities</h2>
      {!me.verified && (
        <Banner tone="info" title="Verify your PVC to join your local communities"
          action={<Button href="/pvc" variant="secondary" size="sm">Verify your PVC</Button>}>
          Verify your PVC to join your LGA, ward (registration area) and polling unit communities.
        </Banner>
      )}
      {me.verified && me.unmatched && <Banner tone="info">We couldn’t match your polling unit to INEC’s list yet. You’re in your state (and LGA, if it matched).</Banner>}
      {!me.geography_loaded && <Banner tone="info">LGA, ward and polling unit communities open when INEC’s polling-unit list is loaded.</Banner>}
      {me.memberships.length ? <CommunityCards items={me.memberships.map((m) => m.community)} /> : <p>You’re not in a state community yet.</p>}
      {!hasState && !me.verified && (
        <form className="comm-composer" onSubmit={(e) => {
          e.preventDefault();
          void run("state", () => api<MyCommunities>("/me/communities/state/", { method: "POST", body: { state } }), "You’ve joined your state community.");
        }}>
          <Select label="Choose your state community" required value={state} onChange={(e) => setState(e.target.value)} placeholder="Choose a state"
            options={STATES} hint="You can change it once every 30 days. Verifying your PVC places you in your registered state." />
          <div><Button type="submit" disabled={!state} loading={busy === "state"}>Join</Button></div>
        </form>
      )}
      <p><Link to="/account/communities">Manage your communities</Link></p>
    </section>
  );
}

export default function CommunitiesPage() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const list = useRequest("communities:top", (signal) => api<Community[]>("/communities/", { anonymous: true, signal }));
  const mine = useRequest(`communities:me:${isSignedIn ? 1 : 0}`, (signal) =>
    isSignedIn ? api<MyCommunities>("/me/communities/", { signal }) : Promise.resolve(null));
  const [me, setMe] = useState<MyCommunities | null>(null);
  useEffect(() => { setMe(mine.data); }, [mine.data]);
  useEffect(() => { document.title = "Communities | NDCConnect"; }, []);

  const national = list.data?.filter((c) => c.level === "national") ?? [];
  const states = list.data?.filter((c) => c.level === "state") ?? [];
  return (
    <div className="comm-page">
      <header className="comm-head">
        <h1>Communities</h1>
        <p>Talk about politics and public life with people where you vote, beyond election time.</p>
      </header>
      {!isSignedIn && (
        <Banner tone="info" title="Sign in to take part" action={<Button href="/sign-in?redirect_url=%2Fcommunities" size="sm">Sign in</Button>}>
          Community posts are for signed-in members.
        </Banner>
      )}
      {isSignedIn && (me ? <YourCommunities me={me} onChange={setMe} /> : mine.error ? <Banner tone="error">{mine.error.message}</Banner>
        : <Skeleton width="100%" height={120} />)}
      <section aria-labelledby="browse-h">
        <h2 id="browse-h">Browse</h2>
        {list.error && <EmptyState title="Communities couldn’t load" action={<Button onClick={list.retry}>Try again</Button>} />}
        {!list.data && !list.error && <Skeleton width="100%" height={200} />}
        {list.data && <><CommunityCards items={national} /><h3>States</h3><CommunityCards items={states} /></>}
      </section>
    </div>
  );
}
