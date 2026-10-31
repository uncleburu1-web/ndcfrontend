/**
 * Frontend feature flags.
 *
 * donationsEnabled stays FALSE until the donation spec ships its compliance checks
 * (SRS FR-046: no donations where compliance can't be satisfied). Spec 03 §8.4.
 */
export const donationsEnabled = import.meta.env.VITE_DONATIONS_ENABLED === "true";
