/**
 * Vote (Follow) + notification bell for one candidate — spec 04 §4, §8.3.
 * - card: Vote only, helper hidden (the page intro carries it once).
 * - profile / following: Vote + the bell, which appears only while following.
 */
import { NotificationToggle, VoteToggle } from "../components/ui";
import { useFollows, type FollowOptions } from "./FollowProvider";
import "./follows.css";

interface Props {
  slug: string;
  name: string;
  variant: "card" | "profile" | "following";
  onGone?: FollowOptions["onGone"];
}

export function CandidateVote({ slug, name, variant, onGone }: Props) {
  const f = useFollows();
  const following = f.isFollowing(slug);
  return (
    <div className={`cand-vote cand-vote--${variant}`}>
      <VoteToggle
        candidateName={name}
        following={following}
        hideHelper={variant !== "profile"}
        onChange={(next) => (next ? f.follow(slug, name, { from: variant, onGone }) : f.unfollow(slug, name))}
      />
      {variant !== "card" && (
        <NotificationToggle
          candidateName={name}
          following={following}
          enabled={f.notifyOf(slug)}
          onChange={(on) => f.setNotify(slug, name, on)}
        />
      )}
    </div>
  );
}
