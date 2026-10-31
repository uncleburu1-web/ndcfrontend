/**
 * Toast — spec §6.11. Floating, short-lived message (gets --shadow-overlay).
 * Wrap the app in <ToastProvider>; call useToast().show({ tone, message }).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "./Toast.css";

export type ToastTone = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  show: (toast: { tone?: ToastTone; message: string; durationMs?: number }) => void;
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

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi["show"]>(
    ({ tone = "info", message, durationMs = 5000 }) => {
      const id = nextId.current++;
      setItems((all) => [...all, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ds-toasts" role="region" aria-label="Notifications">
        {/* polite: never steals focus or interrupts */}
        <div aria-live="polite" aria-atomic="false">
          {items.map((t) => (
            <Toast key={t.id} tone={t.tone} message={t.message} onDismiss={() => dismiss(t.id)} />
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
export function Toast({ tone, message, onDismiss }: { tone: ToastTone; message: string; onDismiss?: () => void }) {
  return (
    <div className={`ds-toast ds-toast--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="ds-toast__icon">
        <Icon name={TONE_ICON[tone]} />
      </span>
      <p className="ds-toast__message">{message}</p>
      {onDismiss && (
        <button type="button" className="ds-toast__close" onClick={onDismiss} aria-label="Dismiss notification">
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
