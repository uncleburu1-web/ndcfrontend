/**
 * Toast — spec §6.11. Floating, short-lived message (gets --shadow-overlay).
 * Wrap the app in <ToastProvider>; call useToast().show({ tone, message }).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "./Toast.css";
import { t as tr } from "../../i18n";

export type ToastTone = "info" | "success" | "warning" | "error";

/** Optional follow-up action, e.g. "View profile". A button, so it works outside the router too. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  show: (toast: { tone?: ToastTone; message: string; durationMs?: number; action?: ToastAction }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICON: Record<ToastTone, IconName> = {
  info: "info",
  success: "checkCircle",
  warning: "alert",
  error: "xCircle",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<number>());

  // Auto-dismiss timers stop when the provider unmounts, so none fires into a page that has gone.
  useEffect(() => {
    const all = timers.current;
    return () => {
      all.forEach((t) => window.clearTimeout(t));
      all.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi["show"]>(
    ({ tone = "info", message, durationMs = 5000, action }) => {
      const id = nextId.current++;
      setItems((all) => [...all, { id, tone, message, action }]);
      const t = window.setTimeout(() => {
        timers.current.delete(t);
        dismiss(id);
      }, durationMs);
      timers.current.add(t);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ds-toasts" role="region" aria-label={tr("ui.notifications")}>
        {/* polite: never steals focus or interrupts */}
        <div aria-live="polite" aria-atomic="false">
          {items.map((t) => (
            <Toast
              key={t.id}
              tone={t.tone}
              message={t.message}
              action={t.action && { label: t.action.label, onClick: () => { dismiss(t.id); t.action!.onClick(); } }}
              onDismiss={() => dismiss(t.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Presentational toast — also rendered statically on the design-system page. */
export function Toast({ tone, message, action, onDismiss }: { tone: ToastTone; message: string; action?: ToastAction; onDismiss?: () => void }) {
  return (
    <div className={`ds-toast ds-toast--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="ds-toast__icon">
        <Icon name={TONE_ICON[tone]} />
      </span>
      <p className="ds-toast__message">
        {message}
        {action && (
          <>
            {" "}
            <button type="button" className="ds-toast__action" onClick={action.onClick}>
              {action.label}
            </button>
          </>
        )}
      </p>
      {onDismiss && (
        <button type="button" className="ds-toast__close" onClick={onDismiss} aria-label={tr("ui.dismiss-notification")}>
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
