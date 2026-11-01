export type PvcStatus = "unverified" | "pending" | "successful" | "rejected";

export interface MyPvc {
  status: PvcStatus;
  vin_masked?: string;
  surname?: string;
  state?: string;
  state_label?: string;
  lga?: string;
  polling_unit?: string;
  reason?: string;
  reviewed_at?: string | null;
  created_at?: string;
  show_badge?: boolean;
}

export interface PvcEvent {
  kind: string;
  note: string;
  created_at: string;
  actor_email: string | null;
}

export interface AdminPvc extends MyPvc {
  id: string;
  user_name: string;
  user_email: string;
  reviewed_by_email: string | null;
  is_own: boolean;
  events: PvcEvent[];
}

export interface AdminPvcPage {
  count: number;
  results: AdminPvc[];
  lookup_url: string;
  pending_count: number;
  oldest_pending_at: string | null;
}

/** GET /pvc/config/ — spec 08 §7. INEC URLs come from server settings; notes are admin-editable plain text. */
export interface PvcConfig {
  inec_pvc_url: string | null;
  inec_voter_check_url: string;
  guidance_note: string;
  collection_note: string;
}
