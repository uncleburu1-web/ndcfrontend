/** Shapes from /search/, /search/suggest/, /states/ (spec 12 §7). */
import type { CandidateSummary } from "../candidates/types";
import type { ArticleSummary } from "../news/types";
import type { FeedPost } from "../posts/types";

export type Range = [number, number];
export type SearchType = "all" | "candidates" | "news" | "posts";
export type ArticleHit = ArticleSummary & { snippet: string; matches: Range[]; title_matches: Range[]; url: string };
export type PostHit = FeedPost & { snippet: string; matches: Range[]; title_matches: Range[]; url: string };

export interface Section<T> { count: number; results: T[] }
export interface AllResults {
  candidates: Section<CandidateSummary>;
  news: Section<ArticleHit>;
  posts: Section<PostHit>;
  did_you_mean: string | null;
  election_year: number | null;
  /** Spec 19 §9: states and LGAs by name. */
  places?: Section<PlaceHit>;
}
/** "Ikeja, Lagos State" → /states/lagos/ikeja (spec 19 §9). */
export interface PlaceHit { kind: "state" | "lga"; title: string; state: string; url: string }
export interface TypeResults<T> {
  count: number;
  page: number;
  next: number | null;
  previous: number | null;
  results: T[];
  did_you_mean: string | null;
  election_year: number | null;
}
export interface Suggestions {
  candidates: CandidateSummary[];
  titles: { type: "news" | "post"; title: string; url: string; candidate?: string }[];
  places?: PlaceHit[];
}
export interface StateSummary { state: string; label: string; candidates: number; news: number; posts: number }
export interface StateGroup { position: string; label: string; total: number; results: CandidateSummary[] }
export interface StateDetail {
  state: string;
  label: string;
  election_year: number | null;
  groups: StateGroup[];
  news: ArticleSummary[];
  posts: FeedPost[];
  /** Spec 19 §6.1 */
  capital?: string;
  area_councils?: boolean;
  lgas?: { id: number; code: string; name: string; slug: string; candidates: number; events: number }[];
  constituencies?: { id: number; kind: string; code: string; name: string; candidates: number; lgas: string[] }[];
  about?: { source: string; published_on: string | null; polling_units: number } | null;
}

export const Q_MIN = 2;
