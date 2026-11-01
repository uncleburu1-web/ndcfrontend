/** /membership/card — the member's own digital card (spec 06 §4.3). Private; printable; no public lookup. */
import { useEffect } from "react";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import ndcLogo from "../../assets/brand/ndc-logo.jpg";
import { formatDate } from "../../lib/format";
import type { MembershipCard } from "../../membership/types";
import { useAuthedImage } from "../../membership/useAuthedImage";
import "./join.css";

export default function MembershipCardPage() {
  const api = useApi();
  const { data: c, error, loading } = useRequest("membership-card", (signal) => api<MembershipCard>("/me/membership/card/", { signal }));
  const photo = useAuthedImage(c?.has_photo ? "/me/membership/photo/" : null);
  useEffect(() => {
    document.title = "Membership card | NDCConnect";
  }, []);

  if (error) {
    return <div className="page-shell"><EmptyState title="No active membership" action={<Button href="/join">Join NDC</Button>}>Your card appears here once you’re an active member.</EmptyState></div>;
  }
  if (loading || !c) return <div className="member-card-page" aria-busy="true"><Skeleton width={360} height={220} /></div>;
  return (
    <div className="member-card-page">
      <article className="member-card" aria-label="NDC membership card">
        <header className="member-card__head">
          <img src={ndcLogo} alt="NDC" className="member-card__logo" />
          <span>Nigeria Democratic Congress · Membership card</span>
        </header>
        <div className="member-card__body">
          {photo ? <img src={photo} alt="" className="member-card__photo" width={112} height={112} /> : <span className="member-card__photo member-card__photo--empty" aria-hidden="true" />}
          <dl>
            <div><dt>Name</dt><dd>{c.full_name}</dd></div>
            <div><dt>Membership no.</dt><dd className="member-card__number">{c.membership_number}</dd></div>
            <div><dt>Ward / LGA</dt><dd>{c.ward}, {c.lga}</dd></div>
            <div><dt>State</dt><dd>{c.state}</dd></div>
            <div><dt>Member since</dt><dd>{formatDate(c.member_since)}</dd></div>
          </dl>
        </div>
        <footer className="member-card__foot">Status: Active</footer>
      </article>
      <p className="join-note">Your card is private. Keep it safe.</p>
      <div className="member-card__actions"><Button variant="secondary" onClick={() => window.print()}>Print card</Button></div>
    </div>
  );
}
