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
}

export interface AdminPvc extends MyPvc {
  id: string;
  user_name: string;
  user_email: string;
  reviewed_by_email: string | null;
}

export interface AdminPvcPage {
  count: number;
  results: AdminPvc[];
  lookup_url: string;
  pending_count: number;
}
