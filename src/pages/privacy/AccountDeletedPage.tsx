import { useEffect } from "react";
import { EmptyState } from "../../components/ui";

/** After self-service deletion (spec 14 §4.4). */
export default function AccountDeletedPage() {
  useEffect(() => {
    document.title = "Account deleted | NDCConnect";
  }, []);
  return (
    <section className="auth-page">
      <EmptyState icon="checkCircle" title="Your account has been deleted">
        You’ve been signed out. Your profile, follows, PVC check and membership register details are gone. Donation and payment records are
        kept, anonymised, because the law requires them. Thank you for being part of NDCConnect.
      </EmptyState>
    </section>
  );
}
