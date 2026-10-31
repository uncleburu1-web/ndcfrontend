/**
 * Hand-off signal for the welcome animation (spec §7.6).
 * Emitted once, when PATCH /me returns `just_completed: true`. The welcome-animation
 * spec subscribes with onProfileCompleted(). The "Finish setup" click that triggered it
 * is the user gesture that lets the animation's music start.
 */
const EVENT = "ndc:profile-completed";

export function emitProfileCompleted() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onProfileCompleted(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
