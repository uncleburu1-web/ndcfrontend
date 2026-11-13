/** /campaign — linked campaign accounts pick their candidate (spec 09 §4.1). */
import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Avatar, Banner, Button, EmptyState, Skeleton, StatusBadge } from "../../components/ui";
import type { CampaignCandidate } from "../../posts/types";
import "../../posts/posts.css";
import { t } from "../../i18n";

export default function CampaignHomePage() {
  const api = useApi();
  const res = useRequest("campaign-candidates", (signal) => api<{ results: CampaignCandidate[] }>("/campaign/candidates/", { signal }));
  useEffect(() => {
    document.title = t("campaign.my-campaign-ndcconnect-2");
  }, []);
  if (res.error) return <div className="page-shell"><Banner tone="error">{res.error.message}</Banner></div>;
  if (!res.data) return <div className="campaign-page"><Skeleton width="100%" height={120} /></div>;
  const list = res.data.results;
  if (list.length === 0) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title={t("campaign.you-don-t-have-access-to")} action={<Button href="/candidates">{t("campaign.see-candidates")}</Button>}>
          {t("campaign.my-campaign-is-for-accounts-an")}</EmptyState>
      </div>
    );
  }
  if (list.length === 1) return <Navigate to={`/campaign/${list[0].id}`} replace />;
  return (
    <div className="campaign-page">
      <h1>{t("campaign.my-campaign")}</h1>
      <p className="news-note">{t("campaign.choose-the-candidate-you-re-posting")}</p>
      <ul className="campaign-picker">
        {list.map((c) => (
          <li key={c.id}>
            <Link to={`/campaign/${c.id}`}>
              <Avatar name={c.full_name} src={c.photo?.url_200 ?? undefined} size="md" />
              <span><strong>{c.full_name}</strong><br /><span className="news-meta">{c.position_label}</span></span>
              <StatusBadge set="candidate" status={c.status as "published"} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
