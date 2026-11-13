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
import { t } from "../../i18n";

export default function MembershipCardPage() {
  const api = useApi();
  const { data: c, error, loading } = useRequest("membership-card", (signal) => api<MembershipCard>("/me/membership/card/", { signal }));
  const photo = useAuthedImage(c?.has_photo ? "/me/membership/photo/" : null);
  useEffect(() => {
    document.title = t("join.membership-card-ndcconnect");
  }, []);

  if (error) {
    return <div className="page-shell"><EmptyState title={t("join.no-active-membership")} action={<Button href="/join">{t("join.join-ndc")}</Button>}>{t("join.your-card-appears-here-once-you")}</EmptyState></div>;
  }
  if (loading || !c) return <div className="member-card-page" aria-busy="true"><Skeleton width={360} height={220} /></div>;
  return (
    <div className="member-card-page">
      <article className="member-card" aria-label={t("join.ndc-membership-card")}>
        <header className="member-card__head">
          <img src={ndcLogo} alt="NDC" className="member-card__logo" />
          <span>{t("join.nigeria-democratic-congress-membership-card")}</span>
        </header>
        <div className="member-card__body">
          {photo ? <img src={photo} alt="" className="member-card__photo" width={112} height={112} /> : <span className="member-card__photo member-card__photo--empty" aria-hidden="true" />}
          <dl>
            <div><dt>{t("join.name")}</dt><dd>{c.full_name}</dd></div>
            <div><dt>{t("join.membership-no")}</dt><dd className="member-card__number">{c.membership_number}</dd></div>
            <div><dt>{t("join.ward-lga")}</dt><dd>{c.ward}, {c.lga}</dd></div>
            <div><dt>{t("join.state")}</dt><dd>{c.state}</dd></div>
            <div><dt>{t("join.member-since")}</dt><dd>{formatDate(c.member_since)}</dd></div>
          </dl>
        </div>
        <footer className="member-card__foot">{t("join.status-active")}</footer>
      </article>
      <p className="join-note">{t("join.your-card-is-private-keep-it")}</p>
      <div className="member-card__actions"><Button variant="secondary" onClick={() => window.print()}>{t("join.print-card")}</Button></div>
    </div>
  );
}
