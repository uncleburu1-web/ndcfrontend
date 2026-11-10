/** "DEMO" marker for simulated donations (seed_demo_donations, local previews only). Text, never colour alone. */
import "../components/ui/Badge.css";

export function DemoBadge() {
  return <span className="ds-badge ds-badge--warning" title="Simulated for a preview. Not a real contribution.">DEMO</span>;
}
