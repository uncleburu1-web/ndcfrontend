/** /settings/account — My account (spec 20 §4.1). */
import { useUser } from "@clerk/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { ProfileForm } from "../../auth/ProfileForm";
import { useApi, useMe } from "../../auth/session";
import { Avatar, Select, StatusBadge, useToast } from "../../components/ui";
import { GeoConfirmCard } from "../../geo/GeoConfirmCard";
import { formatDate } from "../../lib/format";
import { STATES, stateLabel } from "../../lib/nigeria";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import { Loading, SectionShell, useSettingsData } from "../SettingsLayout";
import { t } from "../../i18n";

/** Spec 12 §4.5: optional, private; used only to put the person's state first. */
function HomeState() {
  const { me, setMe } = useMe();
  const api = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const change = async (value: string) => {
    setBusy(true);
    try {
      setMe(await api("/me/", { method: "PATCH", body: { home_state: value } }));
      toast.show({ tone: "success", message: value ? t("settings.home-state-set-to", { stateLabel: stateLabel(value) }) : t("settings.home-state-cleared") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("settings.couldn-t-save") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="set-card">
      <h3>{t("settings.home-state")}</h3>
      <Select label={t("settings.home-state")} value={me.home_state ?? ""} disabled={busy} onChange={(e) => void change(e.target.value)}
        hint={t("settings.used-to-show-your-state-first")}
        options={[{ value: "", label: t("settings.not-set") }, ...STATES]} />
    </div>
  );
}

const MEMBERSHIP_SET = new Set(["not_joined", "draft", "payment_pending", "pending_approval", "active", "rejected", "cancelled", "refunded"]);

export default function AccountSection() {
  const { user } = useUser();
  const { me } = useMe();
  const { settings, settingsError, loadSettings } = useSettingsData();
  const a = settings?.account;
  const pvc = me?.pvc_status ?? "unverified";
  const membership = a?.membership_status && MEMBERSHIP_SET.has(a.membership_status) ? a.membership_status : "not_joined";
  return (
    <SectionShell title={t("settings.my-account")} intro={t("settings.only-you-and-platform-administrators-can")}>
      <div className="set-card">
        <h3>{t("settings.name-and-phone")}</h3>
        <ProfileForm submitLabel={t("settings.save-changes")} busyLabel="Saving…" successMessage={t("settings.changes-saved-your-bylines-use-the")} />
      </div>
      <div className="set-card set-rows">
        <div className="set-row">
          <div>
            <strong>{t("settings.email")}</strong>
            <p className="set-meta">{me?.email || a?.email || "—"}</p>
          </div>
          <Link to="/settings/security">{t("settings.change-in-security")}</Link>
        </div>
        <div className="set-row">
          <div className="set-row__photo">
            <Avatar name={me?.full_name || "You"} src={user?.hasImage ? user.imageUrl : undefined} size="lg" />
            <div>
              <strong>{t("settings.photo")}</strong>
              <p className="set-meta">{t("settings.only-you-see-it-and-your")}</p>
            </div>
          </div>
          <Link to="/settings/security">{t("settings.change-in-security")}</Link>
        </div>
        {!settings ? (
          <Loading error={settingsError} retry={() => void loadSettings()} />
        ) : (
          <>
            <div className="set-row">
              <div>
                <strong>{t("settings.account-created")}</strong>
                <p className="set-meta">{a ? formatDate(a.created_at) : "—"}</p>
              </div>
            </div>
            <div className="set-row">
              <div>
                <strong>{t("settings.status")}</strong>
                <p className="set-meta">
                  {t.rich("settings.active", { x1: a?.staff && <> {t("settings.two-step-verification", { v: a.mfa_enabled ? t("settings.on") : t("settings.off") })}</> })}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
      <HomeState />
      <GeoConfirmCard />
      <div className="set-card">
        <h3>{t("settings.your-records")}</h3>
        <ul className="set-links">
          <li><Link to="/join">{t("settings.membership")}</Link> <StatusBadge set="membership" status={membership as "not_joined"} /></li>
          <li>
            <Link to="/pvc">{t("settings.pvc")}</Link>{" "}
            {pvc === "successful" ? <VerifiedVoterBadge /> : <StatusBadge set="pvc" status={pvc} />}
          </li>
          <li><Link to="/my-donations">{t("settings.my-donations")}</Link></li>
          <li><Link to="/account/events">{t("settings.my-events")}</Link></li>
          <li><Link to="/account/volunteering">{t("settings.my-volunteering")}</Link></li>
          <li><Link to="/account/communities">{t("settings.my-communities")}</Link></li>
          <li><Link to="/following">{t("settings.following")}</Link></li>
        </ul>
      </div>
    </SectionShell>
  );
}
