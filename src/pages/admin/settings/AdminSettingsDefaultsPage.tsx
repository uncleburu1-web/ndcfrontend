/**
 * /admin/settings/defaults (spec 20 §14): enabled languages and defaults for NEW accounts. System admins only; every
 * change is audited with before and after values. Existing people's settings are never changed, and no admin page
 * reads or changes a person's preferences.
 */
import { useEffect, useState } from "react";
import type { Schema } from "../../../api/typed";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { Banner, Button, Checkbox, Select, Skeleton, Switch, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { languageWords } from "../../../settings/constants";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../../../settings/settings.css";
import { t } from "../../../i18n";

type Defaults = Schema<"SettingsDefaults">;

export default function AdminSettingsDefaultsPage() {
  const api = useApi();
  const toast = useToast();
  const [d, setD] = useState<Defaults | null>(null);
  const [draft, setDraft] = useState<{ notifications: Record<string, boolean>; default_theme: string; default_text_size: string }>(
    { notifications: {}, default_theme: "system", default_text_size: "standard" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const take = (x: Defaults) => {
    setD(x);
    setDraft({ notifications: { ...x.notifications }, default_theme: x.default_theme, default_text_size: x.default_text_size });
  };
  useEffect(() => {
    document.title = t("admin.settings-defaults-ndcconnect-admin");
    let live = true;  // a late answer from an earlier load must not reset what the admin is choosing
    api<Defaults>("/admin/settings/defaults/")
      .then((x) => live && take(x))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : t("admin.couldn-t-load-the-defaults")));
    return () => {
      live = false;
    };
  }, [api]);

  const patch = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      take(await api<Defaults>("/admin/settings/defaults/", { method: "PATCH", body }));
      toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-save") });
    } finally {
      setBusy(false);
    }
  };

  const toggleLanguage = (code: string, on: boolean) => {
    if (!d) return;
    const next = on ? [...d.enabled_languages, code] : d.enabled_languages.filter((c) => c !== code);
    void patch({ enabled_languages: next }, t("admin.languages-saved"));
  };

  return (
    <div className="adm-page">
      <AdminNav current="settings" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.settings-defaults")}</h1>
          <p className="ds-field__hint">{t("admin.for-new-accounts-only-existing-people")}</p>
        </div>
      </header>
      {error && <Banner tone="error">{error}</Banner>}
      {!d && !error && <Skeleton width="100%" height={320} />}
      {d && (
        <>
          <section className="set-card">
            <h2>{t("admin.enabled-languages")}</h2>
            <p className="set-meta">{t("admin.a-language-can-be-turned-on")}</p>
            <ul className="set-switches">
              {d.languages.map((l) => {
                const ready = d.translations_complete.includes(l.code);
                return (
                  <li key={l.code}>
                    <Checkbox label={languageWords(l.native, l.label)} checked={d.enabled_languages.includes(l.code)}
                      disabled={busy || l.code === "en" || !ready}
                      hint={l.code === "en" ? t("admin.always-on") : ready ? undefined : t("admin.translations-not-complete-yet")}
                      onChange={(e) => toggleLanguage(l.code, e.target.checked)} />
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="set-card">
            <h2>{t("admin.defaults-for-new-accounts")}</h2>
            <h3>{t("admin.notifications")}</h3>
            <ul className="set-switches">
              {Object.entries(d.notification_labels).map(([key, label]) => (
                <li key={key}>
                  <Switch label={label} checked={draft.notifications[key] ?? true}
                    onChange={(on) => setDraft((x) => ({ ...x, notifications: { ...x.notifications, [key]: on } }))} />
                </li>
              ))}
            </ul>
            <div className="set-two">
              <Select label={t("admin.theme")} value={draft.default_theme} onChange={(e) => { const v = e.target.value; setDraft((x) => ({ ...x, default_theme: v })); }}
                options={[{ value: "system", label: t("admin.system") }, { value: "light", label: t("admin.light") }, { value: "dark", label: t("admin.dark") }]} />
              <Select label={t("admin.text-size")} value={draft.default_text_size} onChange={(e) => { const v = e.target.value; setDraft((x) => ({ ...x, default_text_size: v })); }}
                options={[{ value: "standard", label: t("admin.standard") }, { value: "large", label: t("admin.large") }, { value: "larger", label: t("admin.larger") }]} />
            </div>
            <Button loading={busy} loadingLabel={t("admin.saving")}
              onClick={() => void patch({ notifications: draft.notifications, default_theme: draft.default_theme, default_text_size: draft.default_text_size },
                t("admin.defaults-saved-new-accounts-get-them"))}>
              {t("admin.save-defaults")}</Button>
            {d.updated_at && <p className="set-meta">{t("admin.last-changed", { formatDate: formatDate(d.updated_at, { withTime: true }) })}</p>}
          </section>
        </>
      )}
    </div>
  );
}
