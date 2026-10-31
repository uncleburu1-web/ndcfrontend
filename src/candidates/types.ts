export interface CandidatePhoto {
  url_800: string;
  url_200: string;
}

export interface CandidateLink {
  label: string;
  url: string;
}

/** Public list item (spec 03 §7.1). */
export interface CandidateSummary {
  slug: string;
  full_name: string;
  party: string;
  position: string;
  position_label: string;
  election_year: number;
  state: string;
  area_display: string;
  photo: CandidatePhoto | null;
  verified: boolean;
}

/** Public profile (spec 03 §7.1). */
export interface CandidateProfile extends CandidateSummary {
  biography: string;
  campaign_summary: string;
  priorities: string[];
  links: CandidateLink[];
  published_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  election_year?: number | null;
}

export interface PositionsResponse {
  election_year: number | null;
  election_years: number[];
  positions: { position: string; label: string; count: number }[];
}

export type CandidateStatus = "draft" | "published" | "unpublished" | "archived";

/** Admin view — includes internal fields (spec 03 §7.2). */
export interface AdminCandidate {
  id: string;
  slug: string;
  full_name: string;
  party: string;
  position: string;
  position_label: string;
  election_year: number;
  state: string;
  area_name: string;
  ward_name: string;
  area_display: string;
  biography: string;
  campaign_summary: string;
  priorities: string[];
  links: CandidateLink[];
  photo: CandidatePhoto | null;
  status: CandidateStatus;
  is_verified: boolean;
  verified_at: string | null;
  verified_by_email: string | null;
  verification_notes: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  unpublished_by_edit?: boolean;
  /** Single-record admin responses only: counts, never who (spec 04 §7.4). */
  followers?: { total: number; notify_on: number };
}

export interface LinkedAccount {
  user_id: string;
  email: string;
  full_name: string;
  linked_at: string;
}
