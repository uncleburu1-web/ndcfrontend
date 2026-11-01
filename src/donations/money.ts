import { formatNaira } from "../lib/format";

/** Money travels as integer kobo (spec 05 §3.9); people read naira. */
export const formatKobo = (kobo: number) => formatNaira(kobo / 100);
export const nairaToKobo = (naira: number) => Math.round(naira * 100);

export function designationText(d: { designation: string; candidate: { full_name: string; is_public?: boolean } | null }) {
  if (d.designation !== "candidate" || !d.candidate) return "NDC general fund";
  return d.candidate.is_public === false ? `Former candidate: ${d.candidate.full_name}` : `${d.candidate.full_name}'s campaign`;
}
