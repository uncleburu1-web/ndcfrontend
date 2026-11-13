/**
 * Notification toggle — spec 01 §6.4, spec 04 §8.2.
 * A bell switch shown next to Vote, ONLY while following.
 * Label: "Notify me when [Candidate] posts". Off by default — explicit opt-in.
 *
 * `onChange` may return a Promise: the switch is disabled while it's pending and, if
 * it rejects, stays at its previous value and a toast explains what happened
 * (the same pattern as VoteToggle).
 */
import { useState } from "react";
import { Icon } from "./Icon";
import { Switch } from "./fields/Switch";
import { useToast } from "./Toast";
import { t } from "../../i18n";

interface NotificationToggleProps {
  candidateName: string;
  following: boolean;
  /** Defaults to false: notifications are opt-in. */
  enabled?: boolean;
  onChange: (enabled: boolean) => void | Promise<void>;
  disabled?: boolean;
}

export function NotificationToggle({ candidateName, following, enabled = false, onChange, disabled }: NotificationToggleProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!following) return null;

  const handle = async (next: boolean) => {
    const result = onChange(next);
    if (!(result instanceof Promise)) return;
    setBusy(true);
    try {
      await result;
    } catch {
      toast.show({ tone: "error", message: t("ui.we-couldn-t-update-notifications-for", { candidateName }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Switch
      icon={<Icon name="bell" size={18} />}
      label={t("ui.notify-me-when-posts", { candidateName })}
      checked={enabled}
      onChange={(next) => void handle(next)}
      disabled={disabled || busy}
    />
  );
}
