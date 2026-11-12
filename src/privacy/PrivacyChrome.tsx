/**
 * Signed-in prompts from spec 14:
 * - existing users who haven't confirmed they're 18+ go to /setup-profile once per session (§4.3);
 * - people whose follows predate consent records see a one-time confirmation, up to 3 sign-ins (§4.2, §15.3);
 * - a one-time banner when the privacy notice's version changes (§4.1, as 13's rules banner).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApi, useMe } from "../auth/session";
import { Banner, Button, useToast } from "../components/ui";

const AGE_KEY = "ndc_age_prompted";
const FREE_PATHS = ["/setup-profile", "/account/privacy", "/settings/privacy/data", "/settings/manage", "/account-deleted", "/privacy", "/security", "/sign-in", "/sign-up"];

function AgeRedirect() {
  const { me } = useMe();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!me || me.adult_confirmed !== false || !me.full_name || !me.phone_number) return;
    if (FREE_PATHS.some((p) => pathname.startsWith(p))) return;
    try {
      if (window.sessionStorage.getItem(AGE_KEY)) return;
      window.sessionStorage.setItem(AGE_KEY, "1");
    } catch {
      /* private mode: ask anyway */
    }
    navigate("/setup-profile", { state: { from: pathname + search } });
  }, [me, navigate, pathname, search]);
  return null;
}

function LegacyFollowsPrompt() {
  const { me, refresh } = useMe();
  const api = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState<"" | "keep" | "remove">("");
  const [hidden, setHidden] = useState(false);
  const counted = useRef(false);
  const needed = Boolean(me?.consents_needed?.includes("political_following"));
  useEffect(() => {
    if (!needed || counted.current) return;
    counted.current = true;
    void api(`/me/consents/political_following/prompted/`, { method: "POST" }).catch(() => {});
  }, [api, needed]);
  if (!needed || hidden) return null;
  const keep = async () => {
    setBusy("keep");
    try {
      await api(`/me/consents/political_following/`, { method: "POST" });
      setHidden(true);
      toast.show({ tone: "success", message: "Thanks. Your follows stay as they are." });
      void refresh();
    } catch {
      toast.show({ tone: "error", message: "Couldn’t save that. Try again." });
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    setBusy("remove");
    try {
      const r = await api<{ effect: string }>(`/me/consents/political_following/`, { method: "DELETE" });
      setHidden(true);
      toast.show({ tone: "success", message: r.effect || "Your follows were removed." });
      void refresh();
    } catch {
      toast.show({ tone: "error", message: "Couldn’t remove them. Try again." });
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="app-banner">
      <Banner
        tone="info"
        title="Confirm your follows"
        dismissible
        onDismiss={() => setHidden(true)}
        action={
          <div className="privacy-inline-actions">
            <Button size="sm" onClick={keep} loading={busy === "keep"}>Keep them</Button>
            <Button size="sm" variant="secondary" onClick={remove} loading={busy === "remove"}>Remove all</Button>
          </div>
        }
      >
        Following candidates shows your political interest, so we now ask for your consent. Only you can see who you follow.{" "}
        <Link to="/privacy#follows">How we use this</Link>
      </Banner>
    </div>
  );
}

function PrivacyUpdatedBanner() {
  const { me } = useMe();
  const path = useLocation().pathname;
  const v = me?.privacy_version ?? 1;
  if (!me || v <= 1 || path === "/privacy") return null;
  return (
    <div className="app-banner">
      <Banner tone="info" dismissKey={`privacy-v${v}`}>
        Our privacy notice was updated. <Link to="/privacy">Read what changed</Link>.
      </Banner>
    </div>
  );
}

export function PrivacyChrome() {
  const { me } = useMe();
  if (!me) return null;
  return (
    <>
      <AgeRedirect />
      <LegacyFollowsPrompt />
      <PrivacyUpdatedBanner />
    </>
  );
}
