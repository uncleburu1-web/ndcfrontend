/** /settings/security and /settings/connected (spec 20 §9, §11). No passwords, codes or session tokens pass through NDCConnect. */
import { UserProfile, useClerk, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Schema } from "../../api/typed";
import { ApiError, CANCELLED_REVERIFICATION } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Banner, Button, Icon, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { MyPrivacy } from "../../privacy/types";
import { SectionShell, useSettingsData } from "../SettingsLayout";
import { t } from "../../i18n";

function SignOutButtons() {
  const api = useApi();
  const toast = useToast();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const others = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<Schema<"SignedOut">>("/me/settings/security/sign-out-others/", { method: "POST" });
      toast.show({ tone: "success", message: r.signed_out ? `Signed out of ${r.signed_out} other ${r.signed_out === 1 ? "device" : "devices"}.` : t("settings.no-other-devices-were-signed-in") });
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : t("settings.couldn-t-sign-out-your-other"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="set-card">
      <h3>{t("settings.sign-out")}</h3>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="set-actions">
        <Button variant="secondary" onClick={() => void signOut({ redirectUrl: "/" })}>{t("settings.sign-out-of-this-device")}</Button>
        <Button variant="secondary" onClick={() => void others()} loading={busy} loadingLabel={t("settings.signing-out")}>{t("settings.sign-out-of-all-other-devices")}</Button>
      </div>
      <p className="set-meta">{t("settings.signing-out-other-devices-asks-you")}</p>
    </div>
  );
}

function SecurityNotices() {
  const api = useApi();
  const [notices, setNotices] = useState<MyPrivacy["security_notices"] | null>(null);
  useEffect(() => {
    api<MyPrivacy>("/me/privacy/").then((d) => setNotices(d.security_notices)).catch(() => setNotices([]));
  }, [api]);
  return (
    <div className="set-card">
      <h3>{t.rich("settings.recent-security-notices", { icon: <Icon name="shield" size={18} /> })}</h3>
      {notices === null ? <p className="set-meta">{t("settings.loading")}</p> : notices.length === 0 ? <p className="set-meta">{t("settings.none-we-tell-you-here-if")}</p> : (
        <ul className="set-notices">
          {notices.map((n) => (
            <li key={n.id}>
              <p className="set-meta">{formatDate(n.sent_at, { withTime: true })} · {n.reference}</p>
              <p>{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SecuritySection() {
  const { settings } = useSettingsData();
  const a = settings?.account;
  return (
    <SectionShell title={t("settings.security")} intro={t("settings.email-addresses-password-sign-in-connections")}>
      {a?.staff && (
        <Banner tone={a.mfa_enabled ? "success" : "warning"}>
          {t("settings.your-admin-role-needs-two-step", { v: a.mfa_enabled ? t("settings.on") : t("settings.off"), v2: a.mfa_enabled ? "." : t("settings.turn-it-on-below-to-open") })}
        </Banner>
      )}
      <SignOutButtons />
      <SecurityNotices />
      <div className="set-clerk">
        <UserProfile path="/settings/security" routing="path" />
      </div>
    </SectionShell>
  );
}

export function ConnectedSection() {
  const { user } = useUser();
  const { settings } = useSettingsData();
  const accounts = user?.externalAccounts ?? [];
  const campaigns = settings?.connected.campaigns ?? [];
  return (
    <SectionShell title={t("settings.connected-accounts")} intro={t("settings.ndcconnect-has-no-other-third-party")}>
      <div className="set-card">
        <h3>{t("settings.sign-in-connections")}</h3>
        <p className="set-meta">{t.rich("settings.only-used-to-sign-in-add", { link: (chunks) => <Link to="/settings/security">{chunks}</Link> })}</p>
        {accounts.length === 0 ? <p>{t("settings.none-you-sign-in-with-your")}</p> : (
          <ul className="set-links">
            {accounts.map((x) => (
              <li key={x.id}>{x.providerTitle?.() ?? x.provider}{x.emailAddress ? ` · ${x.emailAddress}` : ""}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="set-card">
        <h3>{t("settings.campaign-accounts")}</h3>
        {campaigns.length === 0 ? <p className="set-meta">{t("settings.you-aren-t-linked-to-a")}</p> : (
          <>
            <ul className="set-links">
              {campaigns.map((c) => <li key={c.slug}><Link to={`/candidates/${c.slug}`}>{c.name}</Link></li>)}
            </ul>
            <p className="set-meta">{t("settings.you-post-and-organise-for-these")}</p>
          </>
        )}
      </div>
    </SectionShell>
  );
}
