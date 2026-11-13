import { lazy } from "../i18n";
import { t } from "../i18n";
export type ArticleSource = "official" | "community";
export type ArticleStatus = "pending" | "successful" | "rejected" | "withdrawn" | "removed";

export const CATEGORIES = lazy(() => [
  ["election_updates", t("news.official-election-updates")],
  ["party", t("news.party-announcements")],
  ["campaign", t("news.campaign-announcements")],
  ["community", t("news.community-announcements")],
  ["election_news", t("news.general-election-news")],
] as const);
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
  /** Spec 20 §5.1: the author's public profile handle, only beside a name they chose to show (links to /people/<handle>). */
  byline_profile?: string | null;
  pinned: boolean;
  /** Spec 17 §9: an announcement aimed at a community ("For: Ikeja LGA community"). */
  audience?: { id: string; name: string; path: string } | null;
  /** Spec 21 §9: the language it's written in ("und" = not sure). */
  language?: string;
}

export interface ArticleDetail extends ArticleSummary {
  body: string;
  source_name: string;
  source_url: string;
  /** Spec 21 §10: an official announcement's published versions in other languages, and which one this is. */
  translations?: { language: string; title: string; updated_at: string; out_of_date: boolean }[];
  version_language?: string;
  version_out_of_date?: boolean;
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
export const REPORT_REASONS = lazy(() => [
  ["violence", t("news.threat-or-incitement-to-violence"), "R1"],
  ["abuse", t("news.abusive-or-hateful"), "R2"],
  ["results", t("news.election-results-not-from-inec"), "R3"],
  ["false", t("news.false-or-misleading"), "R4"],
  ["privacy", t("news.private-information-about-someone"), "R5"],
  ["ncii", t("news.intimate-image-shared-without-consent"), "R6"],
  ["copyright", t("news.copyright-my-content-was-used"), "R7"],
  ["spam", t("news.spam-or-advertising"), "R8"],
  ["impersonation", t("news.impersonation"), "R9"],
  ["other", t("news.something-else"), ""],
] as const);

export const PROFILE_REPORT_REASONS = lazy(() => [
  ["profile_wrong", t("news.wrong-or-out-of-date-details")],
  ["not_ndc", t("news.not-an-ndc-candidate")],
  ["impersonation", t("news.impersonation")],
  ["other", t("news.something-else")],
] as const);

export const REJECT_REASONS = lazy(() => [
  t("news.we-couldn-t-verify-it"),
  t("news.election-results-must-come-from-inec"),
  t("news.abusive-or-inciting-language"),
  t("news.shares-private-information"),
  t("news.not-news-opinion-advert-or-promotion"),
  t("news.duplicate"),
  t("news.other"),
]);

export const articlePath = (a: { id: string; source: ArticleSource }) => `/news/${a.source}/${a.id}`;
