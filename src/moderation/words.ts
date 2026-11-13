import { t } from "../i18n";
/** Deadlines in words, never colour alone (spec 13 §4.3, §8). */
export function dueWords(due: { overdue: boolean; hours: number } | null): string {
  if (!due) return "";
  const amount = due.hours >= 48 ? `${Math.floor(due.hours / 24)} days` : due.hours < 1 ? "under 1 h" : `${due.hours} h`;
  return due.overdue ? `Overdue by ${amount}` : `Due in ${amount}`;
}

export function untilWords(iso: string | null, now = new Date()): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  const hours = Math.floor(Math.abs(ms) / 3_600_000);
  return { text: dueWords({ overdue: ms < 0, hours }), overdue: ms < 0 };
}

export const KIND_LABEL: Record<string, string> = { get article() { return t("moderation.news"); }, get post() { return t("moderation.candidate-post"); }, get candidate() { return t("moderation.candidate-profile"); },
  get community_post() { return t("moderation.community-post"); }, get community_comment() { return t("moderation.community-comment"); }, event: "Event" };

export const EVENT_WORDS: Record<string, string> = {
  get opened() { return t("moderation.opened"); },
  get report_added() { return t("moderation.report-added"); },
  get claimed() { return t("moderation.taken"); },
  get released() { return t("moderation.released"); },
  get escalated() { return t("moderation.escalated"); },
  get kept() { return t("moderation.kept-no-action"); },
  get removed() { return t("moderation.removed"); },
  get restored() { return t("moderation.restored"); },
  get warned() { return t("moderation.author-warned"); },
  get paused() { return t("moderation.community-news-paused"); },
  get pause_lifted() { return t("moderation.pause-lifted"); },
  get appeal_opened() { return t("moderation.appeal-received"); },
  get appeal_upheld() { return t("moderation.appeal-upheld"); },
  get appeal_denied() { return t("moderation.appeal-not-upheld"); },
  get notice_linked() { return t("moderation.legal-notice-linked"); },
  get hold_on() { return t("moderation.legal-hold-on"); },
  get hold_off() { return t("moderation.legal-hold-off"); },
  get reporter_viewed() { return t("moderation.reporter-revealed"); },
  get counter_notice() { return t("moderation.counter-notice-received"); },
  get author_removed() { return t("moderation.removed-by-author"); },
};
