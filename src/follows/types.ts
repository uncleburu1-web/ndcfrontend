import type { CandidateSummary, Paginated } from "../candidates/types";

/** GET/PUT/PATCH /me/follows/… — spec 04 §7.3. */
export interface Follow {
  candidate: CandidateSummary;
  notify: boolean;
  followed_at: string;
}

export interface FollowPage extends Paginated<Follow> {
  hidden_count: number;
}

export interface FollowStates {
  results: { slug: string; notify: boolean }[];
}
