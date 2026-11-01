import type { Paginated } from "../candidates/types";

/** GET /donations/config/ — spec 05 §7.1. */
export interface DonationConfig {
  open: boolean;
  min_kobo: number | null;
  max_per_payment_kobo: number | null;
  presets_kobo: number[];
}

export type DonationStatus = "initiated" | "pending" | "successful" | "failed" | "abandoned" | "review" | "refunded";
export type Designation = "party" | "candidate";

export interface DonationCandidate {
  slug: string;
  full_name: string;
  is_public: boolean;
}

/** GET /donations/{reference}/ — the donor's receipt view. */
export interface DonationReceipt {
  reference: string;
  status: DonationStatus;
  status_label: string;
  amount_kobo: number;
  refunded_kobo: number;
  net_kobo: number;
  currency: "NGN";
  designation: Designation;
  candidate: DonationCandidate | null;
  donor_name: string;
  display_choice: "name" | "anonymous" | "guest";
  public_label: string;
  channel: string;
  created_at: string;
  paid_at: string | null;
}

export type MyDonation = Pick<DonationReceipt, "reference" | "status" | "status_label" | "amount_kobo" | "refunded_kobo" | "net_kobo"
  | "designation" | "candidate" | "public_label" | "display_choice" | "created_at" | "paid_at">;

export interface PublicDonation {
  public_label: string;
  amount_kobo: number;
  designation: Designation;
  candidate: DonationCandidate | null;
  paid_on: string;
}

export interface Total {
  total_kobo: number;
  count: number;
}

export interface FinanceSummary {
  overall: Total;
  filtered: Total;
  party: Total;
  candidates: (Total & { slug: string; full_name: string })[];
}

export interface AdminDonation extends DonationReceipt {
  id: string;
  provider: string;
  provider_reference: string;
  review_reason: string;
  election_year: number | null;
  donor_email: string;
  donor_phone: string;
  donor_state: string;
  donor_address: string;
  declarations: { own_funds?: boolean; nigerian_source?: boolean; voluntary?: boolean; accepted_at?: string };
  donor_user_email: string | null;
  refunded_at: string | null;
  last_verified_at: string | null;
  events?: {
    source: string;
    event: string;
    status_from: string;
    status_to: string;
    amount_kobo: number | null;
    currency: string;
    note: string;
    received_at: string;
  }[];
}

export interface AdminDonationPage extends Paginated<AdminDonation> {
  totals: { successful: Total; review: number };
}
