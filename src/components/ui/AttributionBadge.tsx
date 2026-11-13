/**
 * Source attribution badge — spec §6.6 (FR-026). Three treatments, never interchangeable:
 * - official:  info colour, shield icon, "Official"
 * - candidate: red tint, candidate avatar, "Posted by [Candidate]", verified tick if verified
 * - user:      neutral, "Submitted by a member · Reviewed" (only approved items are public)
 * Each is distinguishable by icon/avatar and wording, not by colour alone.
 */
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import "./Badge.css";
import { t } from "../../i18n";

type AttributionBadgeProps =
  | { source: "official" }
  | { source: "candidate"; candidateName: string; avatarSrc?: string; verified?: boolean }
  | { source: "user" };

export function AttributionBadge(props: AttributionBadgeProps) {
  if (props.source === "official") {
    return (
      <span className="ds-attribution ds-attribution--official">
        {t.rich("ui.official", { icon: <Icon name="shield" size={16} /> })}</span>
    );
  }

  if (props.source === "candidate") {
    return (
      <span className="ds-attribution ds-attribution--candidate">
        <Avatar name={props.candidateName} src={props.avatarSrc} size="xs" />
        <span>{t("ui.posted-by", { candidateName: props.candidateName })}</span>
        {props.verified && <Icon name="verified" size={16} label={t("ui.verified-candidate")} className="ds-attribution__verified" />}
      </span>
    );
  }

  return (
    <span className="ds-attribution ds-attribution--user">
      {t.rich("ui.submitted-by-a-member-reviewed", { icon: <Icon name="user" size={16} /> })}</span>
  );
}
