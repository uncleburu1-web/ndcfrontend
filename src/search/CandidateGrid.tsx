import { useEffect } from "react";
import type { CandidateSummary } from "../candidates/types";
import { CandidateCard } from "../components/ui";
import { CandidateVote } from "../follows/CandidateVote";
import { useFollows } from "../follows/FollowProvider";
import "../pages/candidates/candidates.css";

/** Candidate cards with Vote (04); follow state is loaded separately so the public list stays cacheable. */
export function CandidateGrid({ items }: { items: CandidateSummary[] }) {
  const { loadStates } = useFollows();
  const key = items.map((c) => c.slug).join(",");
  useEffect(() => {
    if (key) loadStates(key.split(","));
  }, [key, loadStates]);
  return (
    <div className="cand-grid">
      {items.map((c) => (
        <CandidateCard key={c.slug} name={c.full_name} position={c.position_label} area={c.area_display} party={c.party}
          photoSrc={c.photo?.url_200} verified={c.verified} href={`/candidates/${c.slug}`}
          actions={<CandidateVote slug={c.slug} name={c.full_name} variant="card" />} />
      ))}
    </div>
  );
}
