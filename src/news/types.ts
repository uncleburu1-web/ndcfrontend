export type ArticleSource = "official" | "community";
export type ArticleStatus = "pending" | "successful" | "rejected" | "withdrawn" | "removed";

export const CATEGORIES = [
  ["election_updates", "Official Election Updates"],
  ["party", "Party Announcements"],
  ["campaign", "Campaign Announcements"],
  ["community", "Community Announcements"],
  ["election_news", "General Election News"],
] as const;
export type Category = (typeof CATEGORIES)[number][0];

export interface ArticleImage {
  url_thumb: string;
  url?: string;
  srcset?: string | null;
  width: number | null;
  height: number | null;
}

export interface ArticleSummary {
  id: string;
  source: ArticleSource;
  category: Category | "";
  category_label: string;
  title: string;
  excerpt: string;
  state: string;
  state_label: string;
  image: ArticleImage | null;
  published_at: string | null;
  edited_at: string | null;
  byline: string | null;
  /** Spec 08: true only when the byline shows the author's name and they opted in to the public badge. */
  byline_verified?: boolean;
  pinned: boolean;
  /** Spec 17 §9: an announcement aimed at a community ("For: Ikeja LGA community"). */
  audience?: { id: string; name: string; path: string } | null;
}

export interface ArticleDetail extends ArticleSummary {
  body: string;
  source_name: string;
  source_url: string;
}

export interface NewsPage {
  count: number;
  next: string | null;
  previous: string | null;
  /** Spec 09: candidate posts appear in All and Candidates (source "candidate"). */
  results: (ArticleSummary | import("../posts/types").FeedPost)[];
  pinned: ArticleSummary[];
}

export interface MyArticle extends ArticleDetail {
  status: ArticleStatus;
  status_label: string;
  show_author_name: boolean;
  decision_reason: string;
  removed_reason: string;
  /** Spec 13: the rule it broke ("R4"), "LEGAL", or "" for removals from before the rules. */
  removed_rule?: string;
  submitted_at: string | null;
  created_at: string;
}

export interface AdminArticle extends MyArticle {
  author_name: string;
  author_email: string;
  is_own: boolean;
  open_reports: number;
  important: boolean;
  removed_at: string | null;
  decided_at: string | null;
  events?: { event: string; note: string; created_at: string; actor_email: string | null }[];
  /** Spec 13: reports live in the moderation case. */
  case?: import("../moderation/types").CaseSummary | null;
}

export interface AdminNewsPage {
  count: number;
  results: AdminArticle[];
  counts: { pending: number; reported: number; oldest_open_report: string | null; paused_until: string | null };
}

/** Fallback when /rules/ hasn't loaded; the server's list (with rules) wins (spec 13 §4.2). */
export const REPORT_REASONS = [
  ["violence", "Threat or incitement to violence", "R1"],
  ["abuse", "Abusive or hateful", "R2"],
  ["results", "Election results not from INEC", "R3"],
  ["false", "False or misleading", "R4"],
  ["privacy", "Private information about someone", "R5"],
  ["ncii", "Intimate image shared without consent", "R6"],
  ["copyright", "Copyright (my content was used)", "R7"],
  ["spam", "Spam or advertising", "R8"],
  ["impersonation", "Impersonation", "R9"],
  ["other", "Something else", ""],
] as const;

export const PROFILE_REPORT_REASONS = [
  ["profile_wrong", "Wrong or out-of-date details"],
  ["not_ndc", "Not an NDC candidate"],
  ["impersonation", "Impersonation"],
  ["other", "Something else"],
] as const;

export const REJECT_REASONS = [
  "We couldn’t verify it.",
  "Election results must come from INEC.",
  "Abusive or inciting language.",
  "Shares private information.",
  "Not news (opinion, advert or promotion).",
  "Duplicate.",
  "Other",
];

export const articlePath = (a: { id: string; source: ArticleSource }) => `/news/${a.source}/${a.id}`;
