import { EmptyState } from "../../components/ui";
import { t } from "../../i18n";

/** Shown after the API answers 403 account_deactivated (spec §7.5). */
export default function AccountDeactivatedPage() {
  return (
    <section className="auth-page">
      <EmptyState icon="alert" title={t("auth.this-account-has-been-deactivated")}>
        {t("auth.you-ve-been-signed-out-if")}</EmptyState>
    </section>
  );
}
