/**
 * Avatar — spec §6.11. Image with an initials fallback (also used when the image fails).
 */
import { useState } from "react";
import "./Avatar.css";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  name: string;
  src?: string;
  /** Responsive candidates from the API (`photo.srcset`, spec 15 §7.5). */
  srcSet?: string | null;
  size?: AvatarSize;
}

/** Rendered width per size, so the browser picks the smallest file that is sharp enough. */
const AVATAR_PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 48, lg: 96, xl: 160 };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, srcSet, size = "md" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <span className={`ds-avatar ds-avatar--${size}`}>
      {showImage ? (
        <img src={src} srcSet={srcSet ?? undefined} sizes={srcSet ? `${AVATAR_PX[size]}px` : undefined} alt=""
          onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
