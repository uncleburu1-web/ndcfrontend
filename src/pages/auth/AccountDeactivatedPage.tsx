import { EmptyState } from "../../components/ui";

/** Shown after the API answers 403 account_deactivated (spec §7.5). */
export default function AccountDeactivatedPage() {
  return (
    <section className="auth-page">
      <EmptyState icon="alert" title="This account has been deactivated">
        You’ve been signed out. If you think this is a mistake, contact NDCConnect support. You can still browse public
        pages and donate as a guest.
      </EmptyState>
    </section>
  );
}
