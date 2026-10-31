/**
 * Notification toggle — spec §6.4.
 * A bell switch shown next to Vote, ONLY while following.
 * Label: "Notify me when [Candidate] posts". Off by default — explicit opt-in.
 */
import { Icon } from "./Icon";
import { Switch } from "./fields/Switch";

interface NotificationToggleProps {
  candidateName: string;
  following: boolean;
  /** Defaults to false: notifications are opt-in. */
  enabled?: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function NotificationToggle({ candidateName, following, enabled = false, onChange, disabled }: NotificationToggleProps) {
  if (!following) return null;
  return (
    <Switch
      icon={<Icon name="bell" size={18} />}
      label={`Notify me when ${candidateName} posts`}
      checked={enabled}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
