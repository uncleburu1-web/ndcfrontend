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
      toast.show({ tone: "success", message: value ? `Home state set to ${stateLabel(value)}.` : "Home state cleared." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="set-card">
      <h3>Home state</h3>
      <Select label="Home state" value={me.home_state ?? ""} disabled={busy} onChange={(e) => void change(e.target.value)}
        hint="Used to show your state first. Only you can see it. To show your state or LGA on a public profile, use Profile."
        options={[{ value: "", label: "Not set" }, ...STATES]} />
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
    <SectionShell title="My account" intro="Only you and platform administrators can see these details.">
      <div className="set-card">
        <h3>Name and phone</h3>
        <ProfileForm submitLabel="Save changes" busyLabel="Saving…" successMessage="Changes saved. Your bylines use the new name from now on." />
      </div>
      <div className="set-card set-rows">
        <div className="set-row">
          <div>
            <strong>Email</strong>
            <p className="set-meta">{me?.email || a?.email || "—"}</p>
          </div>
          <Link to="/settings/security">Change in Security</Link>
        </div>
        <div className="set-row">
          <div className="set-row__photo">
            <Avatar name={me?.full_name || "You"} src={user?.hasImage ? user.imageUrl : undefined} size="lg" />
            <div>
              <strong>Photo</strong>
              <p className="set-meta">Only you see it, and your public profile if you choose to show it there.</p>
            </div>
          </div>
          <Link to="/settings/security">Change in Security</Link>
        </div>
        {!settings ? (
          <Loading error={settingsError} retry={() => void loadSettings()} />
        ) : (
          <>
            <div className="set-row">
              <div>
                <strong>Account created</strong>
                <p className="set-meta">{a ? formatDate(a.created_at) : "—"}</p>
              </div>
            </div>
            <div className="set-row">
              <div>
                <strong>Status</strong>
                <p className="set-meta">
                  Active
                  {a?.staff && <> · Two-step verification: {a.mfa_enabled ? "on" : "off"}</>}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
      <HomeState />
      <GeoConfirmCard />
      <div className="set-card">
        <h3>Your records</h3>
        <ul className="set-links">
          <li><Link to="/join">Membership</Link> <StatusBadge set="membership" status={membership as "not_joined"} /></li>
          <li>
            <Link to="/pvc">PVC</Link>{" "}
            {pvc === "successful" ? <VerifiedVoterBadge /> : <StatusBadge set="pvc" status={pvc} />}
          </li>
          <li><Link to="/my-donations">My donations</Link></li>
          <li><Link to="/account/events">My events</Link></li>
          <li><Link to="/account/volunteering">My volunteering</Link></li>
          <li><Link to="/account/communities">My communities</Link></li>
          <li><Link to="/following">Following</Link></li>
        </ul>
      </div>
    </SectionShell>
  );
}
