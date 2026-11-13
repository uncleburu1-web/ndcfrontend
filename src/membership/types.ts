import { t } from "../i18n";
export interface MembershipConfig {
  open: boolean;
  fee_kobo: number;
  requires_approval: boolean;
  inec_pvc_url: string | null;
}

export type MembershipStatus = "draft" | "payment_pending" | "pending_approval" | "active" | "rejected" | "cancelled" | "refunded";
export type DisplayStatus = MembershipStatus | "not_joined" | "pvc_required" | "pvc_pending" | "pvc_rejected" | "pvc_verified";

export interface PaymentSummary {
  reference: string;
  status: string;
  status_label: string;
  amount_kobo: number;
  refunded_kobo: number;
  channel: string;
  created_at: string;
  paid_at: string | null;
}

export interface MyMembership {
  status: MembershipStatus | null;
  display_status: DisplayStatus;
  status_label?: string;
  full_name?: string;
  sex?: "male" | "female" | "";
  date_of_birth?: string | null;
  address?: string;
  state?: string;
  state_label?: string;
  lga?: string;
  ward?: string;
  polling_unit?: string;
  /** Spec 19: how the location links were set, and the chosen places (the member's own view). */
  geo_source?: "" | "matched" | "chosen" | "review";
  place?: import("../geo/types").GeoPlace;
  nin_masked?: string;
  has_photo?: boolean;
  declarations?: Record<string, boolean | string>;
  membership_number?: string | null;
  submitted_at?: string | null;
  activated_at?: string | null;
  decision_reason?: string;
  cancel_reason?: string;
  latest_payment?: PaymentSummary | null;
}

export interface AdminMembership extends MyMembership {
  id: string;
  user_email: string;
  user_phone: string;
  pvc_status: string;
  refund_due: boolean;
  created_at: string;
  /** Detail screen only (spec 06 §4.4). */
  payments?: (PaymentSummary & { provider_reference: string; review_reason: string; events: PaymentEvent[] })[];
  events?: { status_from: string; status_to: string; note: string; created_at: string; actor_email: string | null }[];
  pvc_history?: { kind: string; note: string; created_at: string; actor_email: string | null }[];
  audit?: { action: string; created_at: string; actor_email: string | null }[];
}

export interface PaymentEvent {
  source: string;
  event: string;
  status_from: string;
  status_to: string;
  amount_kobo: number | null;
  currency: string;
  note: string;
  received_at: string;
}

export interface AdminMembershipPage {
  count: number;
  results: AdminMembership[];
  totals: Partial<Record<MembershipStatus, number>>;
}

export interface AdminMembershipPaymentRow extends PaymentSummary {
  member_name: string;
  membership_id: string;
  provider_reference: string;
  review_reason: string;
}

export interface MembershipCard {
  full_name: string;
  membership_number: string;
  state: string;
  lga: string;
  ward: string;
  member_since: string;
  has_photo: boolean;
}

export const DISPLAY_LABELS: Record<DisplayStatus, string> = {
  get not_joined() { return t("membership.not-joined"); },
  get pvc_required() { return t("membership.pvc-verification-required"); },
  get pvc_pending() { return t("membership.pvc-verification-pending"); },
  get pvc_rejected() { return t("membership.pvc-verification-rejected"); },
  get pvc_verified() { return t("membership.pvc-verified"); },
  get draft() { return t("membership.details-in-progress"); },
  get payment_pending() { return t("membership.payment-pending"); },
  get pending_approval() { return t("membership.payment-successful-pending-approval"); },
  get active() { return t("membership.active-member"); },
  get rejected() { return t("membership.rejected"); },
  get cancelled() { return t("membership.cancelled"); },
  get refunded() { return t("membership.refunded"); },
};
