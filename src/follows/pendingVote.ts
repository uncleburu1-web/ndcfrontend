/**
 * A guest's Vote tap, remembered across sign-in / sign-up (spec 04 §4.2).
 * sessionStorage: this tab only. Holds a public slug, a display name and timestamps —
 * never trusted for anything but triggering a normal authenticated PUT (§9).
 */
export const PENDING_VOTE_KEY = "ndc:pendingVote";
export const PENDING_VOTE_TTL_MS = 30 * 60 * 1000;

export interface PendingVote {
  slug: string;
  name: string;
  at: number;
  /** Failed attempts so far; one retry on the next page load, then dropped (§11). */
  tries: number;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null; // storage blocked (private mode, strict settings)
  }
}

export function savePendingVote(slug: string, name: string, now = Date.now()) {
  storage()?.setItem(PENDING_VOTE_KEY, JSON.stringify({ slug, name, at: now, tries: 0 } satisfies PendingVote));
}

export function clearPendingVote() {
  storage()?.removeItem(PENDING_VOTE_KEY);
}

/** The pending vote, or null when absent, malformed or older than 30 minutes (which also clears it). */
export function readPendingVote(now = Date.now()): PendingVote | null {
  const raw = storage()?.getItem(PENDING_VOTE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingVote>;
    const valid =
      typeof v.slug === "string" && /^[a-z0-9-]{1,80}$/.test(v.slug) &&
      typeof v.name === "string" && typeof v.at === "number" && now - v.at <= PENDING_VOTE_TTL_MS && now >= v.at;
    if (!valid) {
      clearPendingVote();
      return null;
    }
    return { slug: v.slug!, name: v.name!.slice(0, 150), at: v.at!, tries: typeof v.tries === "number" ? v.tries : 0 };
  } catch {
    clearPendingVote();
    return null;
  }
}

export function markPendingVoteFailed(v: PendingVote) {
  storage()?.setItem(PENDING_VOTE_KEY, JSON.stringify({ ...v, tries: v.tries + 1 }));
}
