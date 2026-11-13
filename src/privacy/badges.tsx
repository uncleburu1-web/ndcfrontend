/** Badges for privacy requests, incidents and clocks (spec 14 §8.2): icon, words and colour, never colour alone. */
import { Icon, StatusBadge } from "../components/ui";
import type { ClockState, IncidentStatus, RequestStatus } from "./types";
import { t } from "../i18n";

export function RequestStatusBadge({ status, officer = false }: { status: RequestStatus; officer?: boolean }) {
  if (officer && status === "waiting") {
    return (
      <span className="ds-badge ds-badge--neutral">
        {t.rich("privacy.waiting-for-the-person", { icon: <Icon name="minusCircle" size={14} /> })}</span>
    );
  }
  return <StatusBadge set="request" status={status} />;
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <StatusBadge set="incident" status={status} />;
}

export function ClockBadge({ state, words }: { state: ClockState; words: string }) {
  const tone = state === "done" ? "success" : state === "overdue" ? "error" : "warning";
  const icon = state === "done" ? "checkCircle" : state === "overdue" ? "xCircle" : "clock";
  return (
    <span className={`ds-badge ds-badge--${tone}`}>
      <Icon name={icon} size={14} />
      {words}
    </span>
  );
}
