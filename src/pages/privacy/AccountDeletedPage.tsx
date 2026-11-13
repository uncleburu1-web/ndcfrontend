import { useEffect } from "react";
import { EmptyState } from "../../components/ui";
import { t } from "../../i18n";

/** After self-service deletion (spec 14 §4.4). */
export default function AccountDeletedPage() {
  useEffect(() => {
    document.title = t("privacy.account-deleted-ndcconnect");
  }, []);
  return (
    <section className="auth-page">
      <EmptyState icon="checkCircle" title={t("privacy.your-account-has-been-deleted")}>
        {t("privacy.you-ve-been-signed-out-your")}</EmptyState>
    </section>
  );
}
