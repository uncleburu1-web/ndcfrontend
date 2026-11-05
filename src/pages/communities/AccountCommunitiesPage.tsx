/** /account/communities — spec 17 §5.4, §14: memberships, how each was assigned, Leave, Rejoin, new-post bells, change state. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Select, Skeleton, Switch, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { STATES } from "../../lib/nigeria";
import type { MyCommunities } from "../../communities/types";
import { LEVEL_WORDS, communityHref } from "../../communities/types";
import "../../communities/communities.css";

const LOWER = ["lga", "ward", "polling_unit"];

export default function AccountCommunitiesPage() {
  const api = useApi();
  const toast = useToast();
  const res = useRequest("account-communities", (signal) => api<MyCommunities>("/me/communities/", { signal }));
  const [me, setMe] = useState<MyCommunities | null>(null);
  const [busy, setBusy] = useState("");
  const [state, setState] = useState("");
  useEffect(() => { setMe(res.data); }, [res.data]);
  useEffect(() => { document.title = "Your communities | NDCConnect"; }, []);

  const run = async (label: string, fn: () => Promise<MyCommunities>, done: string) => {
    setBusy(label);
    try {
      setMe(await fn());
      toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work. Try again." });
    } finally {
      setBusy("");
    }
  };

  if (res.error) return <div className="comm-page"><Banner tone="error">{res.error.message}</Banner></div>;
  if (!me) return <div className="comm-page"><Skeleton width="100%" height={200} /></div>;
  const chosen = me.memberships.find((m) => m.level === "state" && m.how === "chosen");
  return (
    <div className="comm-page">
      <header className="comm-head">
        <p className="article-back"><Link to="/account">← Account</Link></p>
        <h1>Your communities</h1>
        <p>Nobody can see which communities you’re in. To stop taking part altogether, withdraw your consent in <Link to="/account/privacy">Your data</Link>.</p>
      </header>
      {!me.consented ? (
        <EmptyState title="You haven’t joined communities" action={<Button href="/communities">Go to Communities</Button>} />
      ) : (
        <>
          {me.memberships.length === 0 && <p>You’re not in any community yet. <Link to="/communities">Join one</Link>.</p>}
          <ul className="comm-settings">
            {me.memberships.map((m) => (
              <li key={m.community.id}>
                <div>
                  <Link to={communityHref(m.community.path)}><strong>{m.community.name}</strong></Link>
                  <div className="comm-card__meta">{LEVEL_WORDS[m.level]} · {m.how_label} · joined {formatDate(m.joined_at)}</div>
                </div>
                <div className="comm-post__actions">
                  {LOWER.includes(m.level) && (
                    <Switch label={`New posts in ${m.community.name}`} checked={m.notify_new_posts}
                      onChange={(on: boolean) => void run(`bell:${m.community.id}`, () => api<MyCommunities>(`/me/communities/${m.community.id}/`,
                        { method: "PATCH", body: { notify_new_posts: on } }), on ? "You’ll be told about new posts." : "New-post notifications off.")} />
                  )}
                  <Button variant="ghost" size="sm" loading={busy === `leave:${m.community.id}`} onClick={() => {
                    const msg = m.level === "state" ? "Leave your state community? This also leaves your LGA, ward and polling unit communities." : `Leave ${m.community.name}?`;
                    if (window.confirm(msg)) void run(`leave:${m.community.id}`, () => api<MyCommunities>(`/me/communities/${m.community.id}/`, { method: "DELETE" }), "You’ve left.");
                  }}>Leave</Button>
                </div>
              </li>
            ))}
          </ul>
          {me.left_levels.length > 0 && me.verified && (
            <section aria-labelledby="rejoin-h">
              <h2 id="rejoin-h">Levels you left</h2>
              <div className="comm-post__actions">
                {me.left_levels.map((lv) => (
                  <Button key={lv} variant="secondary" size="sm" loading={busy === `rejoin:${lv}`}
                    onClick={() => void run(`rejoin:${lv}`, () => api<MyCommunities>("/me/communities/rejoin/", { method: "POST", body: { level: lv } }),
                      "You’ve rejoined.")}>Rejoin your {LEVEL_WORDS[lv].toLowerCase()} community</Button>
                ))}
              </div>
            </section>
          )}
          {!me.verified && (
            <section aria-labelledby="state-h">
              <h2 id="state-h">{chosen ? "Change your state community" : "Choose your state community"}</h2>
              {me.state_change_available_at ? (
                <p>You can change it again on {formatDate(me.state_change_available_at)}.</p>
              ) : (
                <form className="comm-composer" onSubmit={(e) => {
                  e.preventDefault();
                  void run("state", () => api<MyCommunities>("/me/communities/state/", { method: "POST", body: { state } }), "Done.");
                }}>
                  <Select label="State" required value={state} onChange={(e) => setState(e.target.value)} placeholder="Choose a state" options={STATES}
                    hint="Once every 30 days. Verifying your PVC places you in your registered state instead." />
                  <div><Button type="submit" disabled={!state} loading={busy === "state"}>Save</Button></div>
                </form>
              )}
              <Banner tone="info" action={<Button href="/pvc" variant="secondary" size="sm">Verify your PVC</Button>}>
                Verify your PVC to join your LGA, ward (registration area) and polling unit communities.
              </Banner>
            </section>
          )}
        </>
      )}
    </div>
  );
}
