/**
 * Banner / alert — spec §6.7. Variants: info, success, warning, error. Optionally dismissible.
 *
 * Pass `dismissKey` to make dismissal stick across visits (e.g. the PVC invitation:
 * once dismissed, it stays hidden). Storage is a light per-browser convenience and is
 * wrapped in try/catch — if storage is unavailable the banner simply dismisses for
 * this page view. Banners are never modals and never block the page.
 */
import { useState, type ReactNode } from "react";
import { ErrorReference, splitReference } from "./ErrorReference";
import { Icon, type IconName } from "./Icon";
import "./Banner.css";

export type BannerTone = "info" | "success" | "warning" | "error";

const TONE_ICON: Record<BannerTone, IconName> = {
  info: "info",
  success: "checkCircle",
  warning: "alert",
  error: "xCircle",
};

const STORAGE_PREFIX = "ndc:banner-dismissed:";

function readDismissed(key?: string): boolean {
  if (!key) return false;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key?: string) {
  if (!key) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, "1");
  } catch {
    /* storage unavailable: dismiss for this view only */
  }
}

interface BannerProps {
  tone?: BannerTone;
  title?: ReactNode;
  children: ReactNode;
  /** Show a dismiss button. */
  dismissible?: boolean;
  /** Remember the dismissal under this key. Implies dismissible. */
  dismissKey?: string;
  onDismiss?: () => void;
  /** Optional action area (e.g. a link button). */
  action?: ReactNode;
}

/** An error message ending in "Reference: …" gets a copyable reference (spec 15 §15.4). */
function withReference(children: ReactNode): ReactNode {
  if (typeof children !== "string") return children;
  const parts = splitReference(children);
  return parts ? <>{parts[0]}<ErrorReference reference={parts[1]} /></> : children;
}

export function Banner({ tone = "info", title, children, dismissible, dismissKey, onDismiss, action }: BannerProps) {
  const [hidden, setHidden] = useState(() => readDismissed(dismissKey));
  if (hidden) return null;

  const canDismiss = dismissible || Boolean(dismissKey);
  const dismiss = () => {
    writeDismissed(dismissKey);
    setHidden(true);
    onDismiss?.();
  };

  return (
    <div className={`ds-banner ds-banner--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="ds-banner__icon">
        <Icon name={TONE_ICON[tone]} />
      </span>
      <div className="ds-banner__body">
        {title && <p className="ds-banner__title">{title}</p>}
        <div className="ds-banner__text">{withReference(children)}</div>
        {action && <div className="ds-banner__action">{action}</div>}
      </div>
      {canDismiss && (
        <button type="button" className="ds-banner__close" onClick={dismiss} aria-label="Dismiss">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
