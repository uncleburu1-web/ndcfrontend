import { stateLabel } from "../lib/nigeria";
import "./search.css";

/** "Filtered to your state: Lagos. Show all states" (spec 12 §4.2, §4.5). */
export function HomeStateChip({ state, onClear }: { state: string; onClear: () => void }) {
  return (
    <p className="home-chip" role="status">
      Filtered to your state: <strong>{stateLabel(state)}</strong>.{" "}
      <button type="button" className="home-chip__clear" onClick={onClear}>Show all states</button>
    </p>
  );
}
