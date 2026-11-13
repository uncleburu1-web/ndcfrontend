/**
 * Modal dialog and bottom sheet — spec §6.11.
 * Both are focus-trapped, close on Esc and on backdrop click, label themselves from
 * their title, and return focus to the element that opened them.
 * BottomSheet is the mobile pattern: it docks to the bottom on small screens and
 * becomes a centred dialog from 640px up.
 */
import { useCallback, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useFocusTrap } from "./useFocusTrap";
import "./Modal.css";
import { t } from "../../i18n";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Footer actions, e.g. Cancel / Confirm buttons. */
  footer?: ReactNode;
}

function Overlay({ open, onClose, title, children, footer, variant }: OverlayProps & { variant: "modal" | "sheet" }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  useFocusTrap(panelRef, open, close);

  if (!open) return null;

  return createPortal(
    <div className={`ds-overlay ds-overlay--${variant}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={panelRef} className={`ds-overlay__panel ds-overlay__panel--${variant}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {variant === "sheet" && <span className="ds-overlay__grabber" aria-hidden="true" />}
        <header className="ds-overlay__header">
          <h2 id={titleId} className="ds-overlay__title">
            {title}
          </h2>
          <button type="button" className="ds-overlay__close" onClick={close} aria-label={t("ui.close")}>
            <Icon name="close" />
          </button>
        </header>
        <div className="ds-overlay__body">{children}</div>
        {footer && <footer className="ds-overlay__footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function Modal(props: OverlayProps) {
  return <Overlay {...props} variant="modal" />;
}

export function BottomSheet(props: OverlayProps) {
  return <Overlay {...props} variant="sheet" />;
}
