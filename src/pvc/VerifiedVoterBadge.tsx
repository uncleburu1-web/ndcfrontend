/** "Verified voter" — icon + text, never colour alone (spec 08 §8). Render only when the backend says Successful. */
import { Icon } from "../components/ui";
import "./pvc-badge.css";
import { t } from "../i18n";

export function VerifiedVoterBadge({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className={`pvc-badge pvc-badge--${size}`}>
      {t.rich("pvc.verified-voter", { icon: <Icon name="verified" size={size === "sm" ? 14 : 16} /> })}</span>
  );
}
