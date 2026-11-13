/**
 * Vote (Follow) toggle — spec §6.3.
 *
 * - Not following: label "Vote", helper "Voting here means following, not an official ballot."
 * - Following: "Voted · Following" with a check icon. Tapping it unfollows *after a
 *   confirmation hint*: the first tap arms it ("Tap again to unfollow"), a second tap
 *   within a few seconds unfollows.
 * - Loading: spinner, control disabled.
 * - Error: the caller's request rejected → the toggle stays at its previous state and
 *   a toast explains what happened.
 * - aria-pressed reflects the following state.
 * - Deliberately shows no count labelled "votes" (spec §6.3, open question §11.5).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useToast } from "./Toast";
import "./VoteToggle.css";
import { t } from "../../i18n";

const CONFIRM_WINDOW_MS = 4000;

interface VoteToggleProps {
  candidateName: string;
  following: boolean;
  /** Persist the change. Resolve on success, reject on failure (the toggle then reverts). */
  onChange?: (nextFollowing: boolean) => Promise<void>;
  /** Force the loading state (used for static previews). */
  loading?: boolean;
  /** Force the "tap again to unfollow" state (used for static previews). */
  confirming?: boolean;
  /** Hide the helper line where it is already shown nearby (e.g. dense lists). */
  hideHelper?: boolean;
}

export function VoteToggle({ candidateName, following, onChange, loading, confirming, hideHelper }: VoteToggleProps) {
  const toast = useToast();
  const helperId = useId();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(armTimer.current), []);
  useEffect(() => setArmed(false), [following]);

  const isLoading = loading || busy;
  const isArmed = confirming || armed;

  const commit = async (next: boolean) => {
    if (!onChange) return;
    setBusy(true);
    try {
      await onChange(next);
    } catch {
      toast.show({
        tone: "error",
        message: next ? t("ui.we-couldn-t-follow-check-your", { candidateName }) : t("ui.we-couldn-t-unfollow-check-your", { candidateName }),
      });
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  const handleClick = () => {
    if (isLoading) return;
    if (!following) {
      void commit(true);
      return;
    }
    if (!isArmed) {
      setArmed(true);
      window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
      return;
    }
    void commit(false);
  };

  let label: string;
  if (isLoading) label = following ? "Updating…" : "Voting…";
  else if (following && isArmed) label = "Tap again to unfollow";
  else if (following) label = "Voted · Following";
  else label = "Vote";

  const state = isLoading ? "loading" : following ? (isArmed ? "confirm" : "following") : "idle";

  return (
    <div className="ds-vote">
      <button
        type="button"
        className={`ds-vote__button ds-vote__button--${state}`}
        aria-pressed={following}
        aria-describedby={hideHelper ? undefined : helperId}
        aria-busy={isLoading || undefined}
        disabled={isLoading}
        onClick={handleClick}
      >
        {isLoading ? (
          <span className="ds-vote__spinner" aria-hidden="true" />
        ) : following && !isArmed ? (
          <Icon name="check" size={18} />
        ) : null}
        <span>{label}</span>
        <span className="visually-hidden">, {candidateName}</span>
      </button>
      {!hideHelper && (
        <p id={helperId} className="ds-vote__helper">
          {t("ui.voting-here-means-following-not-an")}</p>
      )}
      <span className="visually-hidden" aria-live="polite">
        {following && isArmed ? t("ui.tap-again-to-unfollow", { candidateName }) : ""}
      </span>
    </div>
  );
}
