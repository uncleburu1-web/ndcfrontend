import { stateLabel } from "../lib/nigeria";
import "./search.css";
import { t } from "../i18n";

/** "Filtered to your state: Lagos. Show all states" (spec 12 §4.2, §4.5). */
export function HomeStateChip({ state, onClear }: { state: string; onClear: () => void }) {
  return (
    <p className="home-chip" role="status">
      {t.rich("search.filtered-to-your-state-show-all", { stateLabel: stateLabel(state), strong: (chunks) => <strong>{chunks}</strong>, button: (chunks) => <button type="button" className="home-chip__clear" onClick={onClear}>{chunks}</button> })}
    </p>
  );
}
