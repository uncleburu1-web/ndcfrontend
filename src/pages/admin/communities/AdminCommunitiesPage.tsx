/**
 * /admin/communities — spec 17 §15 (system admins): the tree, settings (posting, who can read, NDC members only),
 * counts (exact for national, state and LGA; banded below), scoped moderators and open cases. Changes are audited.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Select, Skeleton, Switch, useToast } from "../../../components/ui";
import type { AdminCommunity } from "../../../communities/types";
import { LEVEL_WORDS, communityHref } from "../../../communities/types";
import { AdminNav } from "../AdminNav";
import "../../../communities/communities.css";
import { t } from "../../../i18n";

function Row({ c: initial }: { c: AdminCommunity }) {
  const api = useApi();
  const toast = useToast();
  const [c, setC] = useState(initial);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AdminCommunity | null>(null);
  const [kids, setKids] = useState<AdminCommunity[] | null>(null);
  const change = async (body: Partial<AdminCommunity>) => {
    try {
      const next = await api<AdminCommunity>(`/admin/communities/${c.id}/`, { method: "PATCH", body });
      setC(next);
      setDetail(next);
      toast.show({ tone: "success", message: t("admin.saved") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-save") });
    }
  };
  const expand = async () => {
    setOpen((o) => !o);
    if (!detail) setDetail(await api<AdminCommunity>(`/admin/communities/${c.id}/`));
    if (kids === null && c.has_children) setKids(await api<AdminCommunity[]>(`/admin/communities/?parent=${c.id}`));
  };
  return (
    <li>
      <div className="comm-tree__row">
        <div>
          <Link to={communityHref(c.path)}><strong>{c.name}</strong></Link>
          <div className="comm-card__meta">{t("admin.members-posts", { LEVEL_WORDS: LEVEL_WORDS[c.level], member_count: c.member_count, post_count: c.post_count, v: c.active ? "" : t("admin.closed") })}</div>
        </div>
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => void expand()}>{open ? t("admin.close") : t("admin.settings")}</Button>
      </div>
      {open && detail && (
        <div className="comm-composer">
          <Switch label={t("admin.posting-open")} checked={c.posting_open} onChange={(v) => void change({ posting_open: v })}
            hint={t("admin.off-members-read-nobody-posts-or")} />
          <Switch label={t("admin.ndc-members-only")} checked={c.ndc_members_only} onChange={(v) => void change({ ndc_members_only: v })}
            hint={t("admin.off-everywhere-unless-the-party-decides")} />
          <Select label={t("admin.who-can-read")} value={c.read_scope} onChange={(e) => void change({ read_scope: e.target.value })}
            options={[{ value: "signed_in", label: t("admin.signed-in-users") }, { value: "members", label: t("admin.members-only") }]} />
          <p>{t.rich("admin.open-cases-moderators-here", { open_cases: detail.open_cases, link: (chunks) => <Link to={`/admin/moderation?type=communities&community=${c.id}`}>{chunks}</Link>, v: detail.moderators.length ? detail.moderators.join(", ") : t("admin.none-appoint-on-the-team-page") })}</p>
        </div>
      )}
      {open && kids && kids.length > 0 && <ul>{kids.map((k) => <Row key={k.id} c={k} />)}</ul>}
    </li>
  );
}

export default function AdminCommunitiesPage() {
  const api = useApi();
  const res = useRequest("admin-communities", (signal) => api<AdminCommunity[]>("/admin/communities/", { signal }));
  return (
    <div className="adm-page">
      <AdminNav current="communities" />
      <header className="adm-page__head"><div><h1>{t("admin.communities")}</h1>
        <p>{t.rich("admin.created-from-inec-s-geography-by", { code: (chunks) => <code>{chunks}</code> })}</p></div></header>
      {res.error && <Banner tone="error">{res.error.message}</Banner>}
      {!res.data && !res.error && <Skeleton width="100%" height={300} />}
      {res.data && <ul className="comm-tree">{res.data.map((c) => <Row key={c.id} c={c} />)}</ul>}
    </div>
  );
}
