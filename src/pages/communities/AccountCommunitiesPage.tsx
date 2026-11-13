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
import { t } from "../../i18n";

const LOWER = ["lga", "ward", "polling_unit"];

export default function AccountCommunitiesPage() {
  const api = useApi();
  const toast = useToast();
  const res = useRequest("account-communities", (signal) => api<MyCommunities>("/me/communities/", { signal }));
  const [me, setMe] = useState<MyCommunities | null>(null);
  const [busy, setBusy] = useState("");
  const [state, setState] = useState("");
  useEffect(() => { setMe(res.data); }, [res.data]);
  useEffect(() => { document.title = t("communities.your-communities-ndcconnect"); }, []);

  const run = async (label: string, fn: () => Promise<MyCommunities>, done: string) => {
    setBusy(label);
    try {
      setMe(await fn());
      toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("communities.that-didn-t-work-try-again") });
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
        <p className="article-back"><Link to="/settings/account">{t("communities.my-account")}</Link></p>
        <h1>{t("communities.your-communities")}</h1>
        <p>{t.rich("communities.nobody-can-see-which-communities-you", { link: (chunks) => <Link to="/settings/privacy/data">{chunks}</Link> })}</p>
      </header>
      {!me.consented ? (
        <EmptyState title={t("communities.you-haven-t-joined-communities")} action={<Button href="/communities">{t("communities.go-to-communities")}</Button>} />
      ) : (
        <>
          {me.memberships.length === 0 && <p>{t.rich("communities.you-re-not-in-any-community", { link: (chunks) => <Link to="/communities">{chunks}</Link> })}</p>}
          <ul className="comm-settings">
            {me.memberships.map((m) => (
              <li key={m.community.id}>
                <div>
                  <Link to={communityHref(m.community.path)}><strong>{m.community.name}</strong></Link>
                  <div className="comm-card__meta">{t("communities.joined", { LEVEL_WORDS: LEVEL_WORDS[m.level], how_label: m.how_label, formatDate: formatDate(m.joined_at) })}</div>
                </div>
                <div className="comm-post__actions">
                  {LOWER.includes(m.level) && (
                    <Switch label={t("communities.new-posts-in", { name: m.community.name })} checked={m.notify_new_posts}
                      onChange={(on: boolean) => void run(`bell:${m.community.id}`, () => api<MyCommunities>(`/me/communities/${m.community.id}/`,
                        { method: "PATCH", body: { notify_new_posts: on } }), on ? t("communities.you-ll-be-told-about-new") : t("communities.new-post-notifications-off"))} />
                  )}
                  <Button variant="ghost" size="sm" loading={busy === `leave:${m.community.id}`} onClick={() => {
                    const msg = m.level === "state" ? "Leave your state community? This also leaves your LGA, ward and polling unit communities." : `Leave ${m.community.name}?`;
                    if (window.confirm(msg)) void run(`leave:${m.community.id}`, () => api<MyCommunities>(`/me/communities/${m.community.id}/`, { method: "DELETE" }), t("communities.you-ve-left"));
                  }}>{t("communities.leave")}</Button>
                </div>
              </li>
            ))}
          </ul>
          {me.left_levels.length > 0 && me.verified && (
            <section aria-labelledby="rejoin-h">
              <h2 id="rejoin-h">{t("communities.levels-you-left")}</h2>
              <div className="comm-post__actions">
                {me.left_levels.map((lv) => (
                  <Button key={lv} variant="secondary" size="sm" loading={busy === `rejoin:${lv}`}
                    onClick={() => void run(`rejoin:${lv}`, () => api<MyCommunities>("/me/communities/rejoin/", { method: "POST", body: { level: lv } }),
                      t("communities.you-ve-rejoined"))}>{t("communities.rejoin-your-community", { toLowerCase: LEVEL_WORDS[lv].toLowerCase() })}</Button>
                ))}
              </div>
            </section>
          )}
          {!me.verified && (
            <section aria-labelledby="state-h">
              <h2 id="state-h">{chosen ? t("communities.change-your-state-community") : t("communities.choose-your-state-community")}</h2>
              {me.state_change_available_at ? (
                <p>{t("communities.you-can-change-it-again-on", { formatDate: formatDate(me.state_change_available_at) })}</p>
              ) : (
                <form className="comm-composer" onSubmit={(e) => {
                  e.preventDefault();
                  void run("state", () => api<MyCommunities>("/me/communities/state/", { method: "POST", body: { state } }), t("communities.done"));
                }}>
                  <Select label={t("communities.state")} required value={state} onChange={(e) => setState(e.target.value)} placeholder={t("communities.choose-a-state")} options={STATES}
                    hint={t("communities.once-every-30-days-verifying-your")} />
                  <div><Button type="submit" disabled={!state} loading={busy === "state"}>{t("communities.save")}</Button></div>
                </form>
              )}
              <Banner tone="info" action={<Button href="/pvc" variant="secondary" size="sm">{t("communities.verify-your-pvc")}</Button>}>
                {t("communities.verify-your-pvc-to-join-your")}</Banner>
            </section>
          )}
        </>
      )}
    </div>
  );
}
