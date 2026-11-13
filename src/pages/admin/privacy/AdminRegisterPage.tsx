/** /admin/privacy/register — the full data register, read-only (spec 14 §5.2). */
import { useEffect } from "react";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Skeleton } from "../../../components/ui";
import { AdminNav } from "../AdminNav";
import { PrivacyNav } from "./PrivacyNav";
import "../candidates/admin.css";
import "../../../privacy/privacy.css";
import { t } from "../../../i18n";

interface Row {
  key: string; label: string; models: string[]; collected: string; purpose: string; lawful_basis: string; visible_to: string;
  retention: string; on_deletion: string; sensitive: boolean; job: string | null; public: boolean;
}

export default function AdminRegisterPage() {
  const api = useApi();
  const res = useRequest("register", (signal) => api<{ categories: Row[]; not_personal: Record<string, string> }>("/admin/privacy/register/", { signal }));
  useEffect(() => {
    document.title = t("admin.data-register-ndcconnect-admin");
  }, []);
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="register" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.data-register")}</h1>
          <p className="ds-field__hint">{t("admin.every-category-of-personal-data-ndcconnect")}</p>
        </div>
      </header>
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-the-register")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={240} />
      ) : (
        <>
          {res.data.categories.map((c) => (
            <section key={c.key} className="adm-panel" aria-labelledby={`reg-${c.key}`}>
              <h2 id={`reg-${c.key}`}>{c.label}{c.sensitive && <span className="privacy-tag">{t("admin.sensitive")}</span>}{!c.public && <span className="privacy-tag">{t("admin.internal-2")}</span>}</h2>
              <dl className="privacy-dl">
                <dt>{t("admin.records")}</dt><dd><code>{c.models.join(", ")}</code></dd>
                <dt>{t("admin.what")}</dt><dd>{c.collected}</dd>
                <dt>{t("admin.why")}</dt><dd>{c.purpose}</dd>
                <dt>{t("admin.lawful-basis")}</dt><dd>{c.lawful_basis}</dd>
                <dt>{t("admin.who-can-see-it")}</dt><dd>{c.visible_to}</dd>
                <dt>{t("admin.retention")}</dt><dd>{c.retention}{c.job ? t("admin.job", { job: c.job }) : ""}</dd>
                <dt>{t("admin.on-deletion")}</dt><dd>{c.on_deletion}</dd>
              </dl>
            </section>
          ))}
          <section className="adm-panel">
            <h2>{t("admin.not-personal-data")}</h2>
            <ul className="privacy-list">{Object.entries(res.data.not_personal).map(([m, why]) => <li key={m}><code>{m}</code>: {why}</li>)}</ul>
          </section>
        </>
      )}
    </div>
  );
}
