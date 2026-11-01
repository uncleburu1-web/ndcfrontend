/**
 * Status badge — spec §6.5. Icon + text + colour, never colour alone.
 * Tone mapping: Pending → warning · Success → success · Failure → error · Neutral → muted.
 */
import { Icon, type IconName } from "./Icon";
import "./Badge.css";

export type Tone = "warning" | "success" | "error" | "neutral";

const STATUS_SETS = {
  news: {
    pending: ["Pending", "warning"],
    successful: ["Successful", "success"],
    rejected: ["Rejected", "error"],
  },
  pvc: {
    unverified: ["Unverified", "neutral"],
    pending: ["Pending", "warning"],
    successful: ["Successful", "success"],
    rejected: ["Rejected", "error"],
  },
  membership: {
    not_joined: ["Not joined", "neutral"],
    payment_pending: ["Payment pending", "warning"],
    pending_approval: ["Pending approval", "warning"],
    active: ["Active member", "success"],
    rejected: ["Rejected", "error"],
    cancelled: ["Cancelled", "error"],
    refunded: ["Refunded", "neutral"],
  },
  payment: {
    pending: ["Pending", "warning"],
    successful: ["Successful", "success"],
    failed: ["Failed", "error"],
    refunded: ["Refunded", "neutral"],
  },
  volunteer: {
    pending: ["Pending", "warning"],
    accepted: ["Accepted", "success"],
    declined: ["Declined", "error"],
  },
  candidate: {
    draft: ["Draft", "neutral"],
    published: ["Published", "success"],
    unpublished: ["Unpublished", "warning"],
    archived: ["Archived", "neutral"],
  },
  verification: {
    verified: ["Verified", "success"],
    not_verified: ["Not verified", "neutral"],
  },
  donation: {
    initiated: ["Started", "neutral"],
    pending: ["Pending", "warning"],
    successful: ["Successful", "success"],
    failed: ["Failed", "error"],
    abandoned: ["Abandoned", "neutral"],
    review: ["Under review", "warning"],
    refunded: ["Refunded", "neutral"],
  },
} as const satisfies Record<string, Record<string, readonly [string, Tone]>>;

export type StatusSet = keyof typeof STATUS_SETS;
export type StatusOf<S extends StatusSet> = keyof (typeof STATUS_SETS)[S];

const TONE_ICON: Record<Tone, IconName> = {
  warning: "clock",
  success: "checkCircle",
  error: "xCircle",
  neutral: "minusCircle",
};

export function statusOptions<S extends StatusSet>(set: S): StatusOf<S>[] {
  return Object.keys(STATUS_SETS[set]) as StatusOf<S>[];
}

interface StatusBadgeProps<S extends StatusSet> {
  set: S;
  status: StatusOf<S>;
}

export function StatusBadge<S extends StatusSet>({ set, status }: StatusBadgeProps<S>) {
  const [label, tone] = (STATUS_SETS[set] as Record<string, readonly [string, Tone]>)[status as string];
  return (
    <span className={`ds-badge ds-badge--${tone}`}>
      <Icon name={TONE_ICON[tone]} size={14} />
      {label}
    </span>
  );
}
