/**
 * Skeleton loader — spec §6.11. Decorative; pair with an aria-busy container or
 * visually-hidden "Loading…" text so screen-reader users know content is coming.
 */
import type { CSSProperties } from "react";
import "./Skeleton.css";

interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  circle?: boolean;
}

export function Skeleton({ width = "100%", height = 16, circle }: SkeletonProps) {
  return <span className={`ds-skeleton${circle ? " ds-skeleton--circle" : ""}`} style={{ width, height }} aria-hidden="true" />;
}
