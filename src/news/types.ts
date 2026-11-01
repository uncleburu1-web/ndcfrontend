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
  pinned: boolean;
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
  results: ArticleSummary[];
  pinned: ArticleSummary[];
}

export interface MyArticle extends ArticleDetail {
  status: ArticleStatus;
  status_label: string;
  show_author_name: boolean;
  decision_reason: string;
  removed_reason: string;
  submitted_at: string | null;
  created_at: string;
}

export interface ArticleReport {
  id: string;
  reason: string;
  reason_label: string;
  details: string;
  status: "open" | "dismissed" | "actioned";
  contact_email: string;
  reporter_email: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string;
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
  reports?: ArticleReport[];
}

export interface AdminNewsPage {
  count: number;
  results: AdminArticle[];
  counts: { pending: number; reported: number; oldest_open_report: string | null; paused_until: string | null };
}

export const REPORT_REASONS = [
  ["false", "False or misleading"],
  ["abuse", "Abusive, hateful or inciting"],
  ["privacy", "Private information about someone"],
  ["copyright", "Copyright (my content was used)"],
  ["spam", "Spam or advertising"],
  ["other", "Other"],
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
