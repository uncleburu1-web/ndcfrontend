/**
 * Status badge — spec §6.5. Icon + text + colour, never colour alone.
 * Tone mapping: Pending → warning · Success → success · Failure → error · Neutral → muted.
 */
import { Icon, type IconName } from "./Icon";
import "./Badge.css";
import { getLanguage, hasOwn, t } from "../../i18n";

export type Tone = "warning" | "success" | "error" | "neutral";

const STATUS_SETS = {
  news: {
    pending: ["Pending", "warning"],
    successful: ["Successful", "success"],
    rejected: ["Rejected", "error"],
    withdrawn: ["Withdrawn", "neutral"],
    removed: ["Removed", "warning"],
  },
  pvc: {
    unverified: ["Unverified", "neutral"],
    pending: ["Pending", "warning"],
    successful: ["Successful", "success"],
    rejected: ["Rejected", "error"],
  },
  membership: {
    not_joined: ["Not joined", "neutral"],
    draft: ["Details in progress", "neutral"],
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
  post: {
    published: ["Published", "success"],
    removed: ["Removed", "warning"],
    deleted: ["Deleted", "neutral"],
  },
  role: {
    active: ["Active", "success"],
    revoked: ["Revoked", "neutral"],
  },
  account: {
    active: ["Active", "success"],
    deactivated: ["Deactivated by an admin", "error"],
    paused: ["Paused by the person", "warning"],  // spec 20 §12
    deleted: ["Deleted in Clerk", "neutral"],
  },
  /** Spec 13: moderation priorities, in words as well as colour. */
  priority: {
    legal: ["Legal: 48 h", "error"],
    urgent: ["Urgent", "error"],
    high: ["High", "warning"],
    normal: ["Normal", "neutral"],
    low: ["Low", "neutral"],
  },
  case: {
    open: ["Open", "warning"],
    escalated: ["Escalated", "error"],
    closed: ["Closed", "neutral"],
    kept: ["No action", "neutral"],
    removed: ["Removed", "warning"],
    restored: ["Restored", "success"],
    author_removed: ["Removed by author", "neutral"],
  },
  report: {
    open: ["Open", "warning"],
    actioned: ["Action taken", "success"],
    dismissed: ["No action", "neutral"],
  },
  appeal: {
    pending: ["Waiting for a decision", "warning"],
    upheld: ["Upheld", "success"],
    denied: ["Not upheld", "neutral"],
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
  // Spec 14 §8.2: privacy requests and incidents.
  request: {
    open: ["Open", "warning"],
    waiting: ["Waiting for you", "neutral"],
    done: ["Done", "success"],
    refused: ["Refused", "error"],
  },
  incident: {
    open: ["Open", "error"],
    contained: ["Contained", "warning"],
    closed: ["Closed", "neutral"],
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
  const [english, tone] = (STATUS_SETS[set] as Record<string, readonly [string, Tone]>)[status as string];
  const label = hasOwn(`status.${set}.${String(status)}`) || getLanguage() !== "en" ? t(`status.${set}.${String(status)}`, {}) : english;
  // spec 21: status words come from the catalogue (status.<set>.<status>), English as written here when missing
  return (
    <span className={`ds-badge ds-badge--${tone}`}>
      <Icon name={TONE_ICON[tone]} size={14} />
      {label}
    </span>
  );
}
