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
      toast.show({ tone: "success", message: "Saved." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t save." });
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
          <div className="comm-card__meta">{LEVEL_WORDS[c.level]} · {c.member_count} members · {c.post_count} posts{c.active ? "" : " · closed"}</div>
        </div>
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => void expand()}>{open ? "Close" : "Settings"}</Button>
      </div>
      {open && detail && (
        <div className="comm-composer">
          <Switch label="Posting open" checked={c.posting_open} onChange={(v) => void change({ posting_open: v })}
            hint="Off: members read, nobody posts or comments." />
          <Switch label="NDC members only" checked={c.ndc_members_only} onChange={(v) => void change({ ndc_members_only: v })}
            hint="Off everywhere unless the party decides otherwise." />
          <Select label="Who can read" value={c.read_scope} onChange={(e) => void change({ read_scope: e.target.value })}
            options={[{ value: "signed_in", label: "Signed-in users" }, { value: "members", label: "Members only" }]} />
          <p>Open cases: <Link to={`/admin/moderation?type=communities&community=${c.id}`}>{detail.open_cases}</Link>
            {" · "}Moderators here: {detail.moderators.length ? detail.moderators.join(", ") : "none (appoint on the Team page)"}</p>
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
      <header className="adm-page__head"><div><h1>Communities</h1>
        <p>Created from INEC’s geography by <code>sync_communities</code>. Nobody, admins included, can see who is in a community.</p></div></header>
      {res.error && <Banner tone="error">{res.error.message}</Banner>}
      {!res.data && !res.error && <Skeleton width="100%" height={300} />}
      {res.data && <ul className="comm-tree">{res.data.map((c) => <Row key={c.id} c={c} />)}</ul>}
    </div>
  );
}
