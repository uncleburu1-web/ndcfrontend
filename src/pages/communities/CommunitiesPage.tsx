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
import { t } from "../../i18n";

export function CommunityCards({ items }: { items: Community[] }) {
  return (
    <ul className="comm-cards">
      {items.map((c) => (
        <li key={c.id}>
          <Link className="comm-card" to={communityHref(c.path)}>
            <span className="comm-card__name">{c.name}</span>
            <span className="comm-card__meta">{t("communities.members", { LEVEL_WORDS: LEVEL_WORDS[c.level], members: c.members })}</span>
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
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("communities.that-didn-t-work-try-again") });
    } finally {
      setBusy("");
    }
  };
  if (!me.consented) {
    return (
      <section className="adm-panel" aria-labelledby="join-h">
        <h2 id="join-h">{t("communities.join-your-communities")}</h2>
        <p>{t("communities.discuss-politics-with-people-in-your")}</p>
        <Button loading={busy === "join"} onClick={() => void run("join", () => api<MyCommunities>("/me/communities/join/", { method: "POST" }),
          t("communities.you-ve-joined"))}>{t("communities.join-communities")}</Button>
      </section>
    );
  }
  return (
    <section aria-labelledby="yours-h">
      <h2 id="yours-h">{t("communities.your-communities")}</h2>
      {!me.verified && (
        <Banner tone="info" title={t("communities.verify-your-pvc-to-join-your-2")}
          action={<Button href="/pvc" variant="secondary" size="sm">{t("communities.verify-your-pvc")}</Button>}>
          {t("communities.verify-your-pvc-to-join-your")}</Banner>
      )}
      {me.verified && me.unmatched && <Banner tone="info">{t("communities.we-couldn-t-match-your-polling")}</Banner>}
      {!me.geography_loaded && <Banner tone="info">{t("communities.lga-ward-and-polling-unit-communities")}</Banner>}
      {me.memberships.length ? <CommunityCards items={me.memberships.map((m) => m.community)} /> : <p>{t("communities.you-re-not-in-a-state")}</p>}
      {!hasState && !me.verified && (
        <form className="comm-composer" onSubmit={(e) => {
          e.preventDefault();
          void run("state", () => api<MyCommunities>("/me/communities/state/", { method: "POST", body: { state } }), t("communities.you-ve-joined-your-state-community"));
        }}>
          <Select label={t("communities.choose-your-state-community")} required value={state} onChange={(e) => setState(e.target.value)} placeholder={t("communities.choose-a-state")}
            options={STATES} hint={t("communities.you-can-change-it-once-every")} />
          <div><Button type="submit" disabled={!state} loading={busy === "state"}>{t("communities.join")}</Button></div>
        </form>
      )}
      <p><Link to="/account/communities">{t("communities.manage-your-communities")}</Link></p>
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
  useEffect(() => { document.title = t("communities.communities-ndcconnect"); }, []);

  const national = list.data?.filter((c) => c.level === "national") ?? [];
  const states = list.data?.filter((c) => c.level === "state") ?? [];
  return (
    <div className="comm-page">
      <header className="comm-head">
        <h1>{t("communities.communities")}</h1>
        <p>{t("communities.talk-about-politics-and-public-life")}</p>
      </header>
      {!isSignedIn && (
        <Banner tone="info" title={t("communities.sign-in-to-take-part")} action={<Button href="/sign-in?redirect_url=%2Fcommunities" size="sm">{t("communities.sign-in")}</Button>}>
          {t("communities.community-posts-are-for-signed-in")}</Banner>
      )}
      {isSignedIn && (me ? <YourCommunities me={me} onChange={setMe} /> : mine.error ? <Banner tone="error">{mine.error.message}</Banner>
        : <Skeleton width="100%" height={120} />)}
      <section aria-labelledby="browse-h">
        <h2 id="browse-h">{t("communities.browse")}</h2>
        {list.error && <EmptyState title={t("communities.communities-couldn-t-load")} action={<Button onClick={list.retry}>{t("communities.try-again")}</Button>} />}
        {!list.data && !list.error && <Skeleton width="100%" height={200} />}
        {list.data && <><CommunityCards items={national} /><h3>{t("communities.states")}</h3><CommunityCards items={states} /></>}
      </section>
    </div>
  );
}
