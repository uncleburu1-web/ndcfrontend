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

export const KIND_LABEL: Record<string, string> = { article: "News", post: "Candidate post", candidate: "Candidate profile",
  community_post: "Community post", community_comment: "Community comment" };

export const EVENT_WORDS: Record<string, string> = {
  opened: "Opened",
  report_added: "Report added",
  claimed: "Taken",
  released: "Released",
  escalated: "Escalated",
  kept: "Kept (no action)",
  removed: "Removed",
  restored: "Restored",
  warned: "Author warned",
  paused: "Community news paused",
  pause_lifted: "Pause lifted",
  appeal_opened: "Appeal received",
  appeal_upheld: "Appeal upheld",
  appeal_denied: "Appeal not upheld",
  notice_linked: "Legal notice linked",
  hold_on: "Legal hold on",
  hold_off: "Legal hold off",
  reporter_viewed: "Reporter revealed",
  counter_notice: "Counter-notice received",
  author_removed: "Removed by author",
};
