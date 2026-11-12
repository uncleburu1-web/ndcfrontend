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
      toast.show({ tone: "success", message: r.signed_out ? `Signed out of ${r.signed_out} other ${r.signed_out === 1 ? "device" : "devices"}.` : "No other devices were signed in." });
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : "Couldn’t sign out your other devices. Nothing changed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="set-card">
      <h3>Sign out</h3>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="set-actions">
        <Button variant="secondary" onClick={() => void signOut({ redirectUrl: "/" })}>Sign out of this device</Button>
        <Button variant="secondary" onClick={() => void others()} loading={busy} loadingLabel="Signing out…">Sign out of all other devices</Button>
      </div>
      <p className="set-meta">Signing out other devices asks you to confirm it’s you first.</p>
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
      <h3><Icon name="shield" size={18} /> Recent security notices</h3>
      {notices === null ? <p className="set-meta">Loading…</p> : notices.length === 0 ? <p className="set-meta">None. We tell you here if something affects your account.</p> : (
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
    <SectionShell title="Security" intro="Email addresses, password, sign-in connections, two-step verification and your devices are managed by Clerk, our sign-in provider.">
      {a?.staff && (
        <Banner tone={a.mfa_enabled ? "success" : "warning"}>
          Your admin role needs two-step verification. It’s {a.mfa_enabled ? "on" : "off"}{a.mfa_enabled ? "." : ": turn it on below to open admin pages."}
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
    <SectionShell title="Connected accounts" intro="NDCConnect has no other third-party connections per person, and never shows keys or tokens.">
      <div className="set-card">
        <h3>Sign-in connections</h3>
        <p className="set-meta">Only used to sign in. Add or remove them in <Link to="/settings/security">Security</Link>.</p>
        {accounts.length === 0 ? <p>None. You sign in with your email.</p> : (
          <ul className="set-links">
            {accounts.map((x) => (
              <li key={x.id}>{x.providerTitle?.() ?? x.provider}{x.emailAddress ? ` · ${x.emailAddress}` : ""}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="set-card">
        <h3>Campaign accounts</h3>
        {campaigns.length === 0 ? <p className="set-meta">You aren’t linked to a candidate’s campaign.</p> : (
          <>
            <ul className="set-links">
              {campaigns.map((c) => <li key={c.slug}><Link to={`/candidates/${c.slug}`}>{c.name}</Link></li>)}
            </ul>
            <p className="set-meta">You post and organise for these campaigns. Ask a system admin to remove this link.</p>
          </>
        )}
      </div>
    </SectionShell>
  );
}
