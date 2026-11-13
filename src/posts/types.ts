import { lazy } from "../i18n";
import type { ArticleImage } from "../news/types";
import { t } from "../i18n";

export type PostKind = "announcement" | "news";
export type PostStatus = "published" | "removed" | "deleted";

export interface PostCandidate {
  id?: string;
  slug: string;
  full_name: string;
  position?: string;
  position_label?: string;
  state?: string;
  photo: { url_200: string | null; url_800?: string | null; srcset?: string | null } | null;
  verified?: boolean;
}

export interface PostSummary {
  id: string;
  /** Spec 21 §9: the language it's written in. */
  language?: string;
  kind: PostKind;
  kind_label: string;
  title: string;
  excerpt: string;
  image: ArticleImage | null;
  published_at: string;
  edited_at: string | null;
}

export interface PostDetail extends PostSummary {
  body: string;
  candidate: PostCandidate;
}

/** A candidate post as a /news feed item (spec 09 §6.4). */
export interface FeedPost extends PostSummary {
  source: "candidate";
  candidate: PostCandidate;
  state: string;
  state_label: string;
}

export interface CampaignPost extends PostDetail {
  status: PostStatus;
  status_label: string;
  removed_reason: string;
  removed_rule?: string;
  removed_at: string | null;
  created_at: string;
}

export interface CampaignCandidate extends PostCandidate {
  id: string;
  status: string;
  published: boolean;
  notify_count: number;
  posting_paused_until: string | null;
}

export interface AdminPost extends CampaignPost {
  author_email: string;
  editor_email: string;
  open_reports: number;
  events?: { event: string; note: string; created_at: string; actor_email: string | null }[];
  /** Spec 13: reports live in the moderation case. */
  case?: import("../moderation/types").CaseSummary | null;
}

export const postPath = (slug: string, id: string) => `/candidates/${encodeURIComponent(slug)}/posts/${id}`;
export const TITLE_MAX = 150;
export const BODY_MAX = 10_000;
export const REMOVE_REASONS = lazy(() => [
  t("posts.abusive-or-inciting-language-electoral-act"),
  t("posts.false-or-unsourced-election-results"),
  t("posts.shares-someone-s-private-information"),
  t("posts.hate-speech"),
  t("posts.copyright-complaint"),
  t("posts.other"),
]);
