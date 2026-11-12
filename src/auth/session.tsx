/**
 * Session state shared across the app:
 * - `useApi()`  — the API client wired to Clerk's getToken (spec §7.5)
 * - `useMe()`   — the caller's NDCConnect profile from GET /me
 * - banners for "session ended" and "sign-in unavailable"
 */
import { useAuth, useClerk, useReverification } from "@clerk/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ConsentDialog, type ConsentAsk } from "../privacy/ConsentDialog";
import "../privacy/privacy.css";
import { ApiError, createApiClient, type ApiRequest } from "./api";

export interface Me {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  profile_complete: boolean;
  roles: { id: string; role: string; scope_type: string; scope_id: string | null }[];
  is_system_admin: boolean;
  /** Spec 08: the caller's own PVC status; the "Verified voter" badge shows only when this is "successful". */
  pvc_status?: "unverified" | "pending" | "successful" | "rejected";
  just_completed?: boolean;
  /** Spec 11: admin areas the backend says this account can open ("overview", "news", "team"…). Empty = not an admin. */
  admin_areas?: string[];
  /** Spec 12: optional, private; only pre-fills state filters. "" = not set. */
  home_state?: string;
  /** Spec 14 §4.3: ticked "I'm 18 or older". A complete profile needs it. */
  adult_confirmed?: boolean;
  /** Spec 14 §4.6: from the session's `mfa` claim; null when the claim isn't configured. */
  mfa_enabled?: boolean | null;
  /** Spec 14 §4.2: purposes to ask about again (material change, or legacy follows to confirm). */
  consents_needed?: string[];
  privacy_version?: number;
  /** Spec 14 §4.6: whether the server refuses admin requests without two-step verification. */
  admin_mfa_required?: boolean;
  /** Spec 20 §12: "paused" when the person paused their own account (only the paused screen shows). */
  account_status?: "active" | "paused";
  /** Spec 20 §13: the account's language and display settings (`saved_at` empty = never chosen on purpose). */
  preferences?: {
    language: string;
    theme: "system" | "light" | "dark";
    text_size: "standard" | "large" | "larger";
    contrast: "system" | "standard" | "more";
    motion: "system" | "reduce";
    saved_at: string | null;
    updated_at: string | null;
  };
}

type MeStatus = "idle" | "loading" | "ready" | "error";
export type SessionIssue = "session-ended" | "auth-unavailable" | null;

interface SessionContextValue {
  api: ApiRequest;
  me: Me | null;
  meStatus: MeStatus;
  meError: ApiError | null;
  setMe: (me: Me) => void;
  refreshMe: () => Promise<void>;
  issue: SessionIssue;
  clearIssue: () => void;
  mfaBlocked: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000/api/v1";

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [meStatus, setMeStatus] = useState<MeStatus>("idle");
  const [meError, setMeError] = useState<ApiError | null>(null);
  const [issue, setIssue] = useState<SessionIssue>(null);
  const [mfaBlocked, setMfaBlocked] = useState(false);

  // One API client for the whole session. Clerk's getToken and React Router's navigate can change
  // identity between renders (navigate does on every route change); reading them through refs keeps
  // `api` stable, so effects that depend on it don't re-run or restart in-flight requests.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  // Spec 14 §4.6: Clerk's reverification prompt; the client hands it an attempt that returns Clerk's hint when needed.
  const reverify = useReverification(async (attempt: () => Promise<unknown>) => attempt());
  const reverifyRef = useRef(reverify);
  reverifyRef.current = reverify;
  // Spec 14 §4.2: one consent dialog for every feature; the client waits for the answer and retries.
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const [consentAsk, setConsentAsk] = useState<(ConsentAsk & { resolve: (ok: boolean) => void }) | null>(null);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
        getToken: (o) => getTokenRef.current(o),
        onSessionEnded: () => setIssue("session-ended"),
        onAuthUnavailable: () => setIssue("auth-unavailable"),
        onMfaRequired: () => setMfaBlocked(true),
        withReverification: <T,>(attempt: () => Promise<T>) => reverifyRef.current(attempt) as Promise<T>,
        onConsentRequired: (err) =>
          new Promise<boolean>((resolve) => {
            const x = err.extra as { purpose?: string; version?: number; label?: string; text?: string };
            setConsentAsk({ purpose: x.purpose ?? "", version: x.version ?? 1, label: x.label ?? "Your consent", text: x.text ?? err.message, resolve });
          }),
        onPaused: () => void refreshRef.current?.(),
        onDeactivated: () => {
          setMe(null);
          void signOutRef.current({ redirectUrl: "/account-deactivated" });
          navigateRef.current("/account-deactivated", { replace: true });
        },
      }),
    []
  );

  const agreeConsent = async () => {
    if (!consentAsk) return;
    await api(`/me/consents/${consentAsk.purpose}/`, { method: "POST" });
    consentAsk.resolve(true);
    setConsentAsk(null);
  };
  const declineConsent = () => {
    consentAsk?.resolve(false);
    setConsentAsk(null);
  };

  const refreshMe = useCallback(async () => {
    setMeStatus("loading");
    setMeError(null);
    try {
      setMe(await api<Me>("/me/"));
      setMeStatus("ready");
    } catch (err) {
      setMeError(err instanceof ApiError ? err : new ApiError({}));
      setMeStatus("error");
    }
  }, [api]);

  refreshRef.current = refreshMe;

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) void refreshMe();
    else {
      setMe(null);
      setMeStatus("idle");
    }
  }, [isLoaded, isSignedIn, refreshMe]);

  const value = useMemo<SessionContextValue>(
    () => ({ api, me, meStatus, meError, setMe, refreshMe, issue, clearIssue: () => setIssue(null), mfaBlocked }),
    [api, me, meStatus, meError, refreshMe, issue, mfaBlocked]
  );
  return (
    <SessionContext.Provider value={value}>
      {children}
      <ConsentDialog ask={consentAsk} onAgree={agreeConsent} onDecline={declineConsent} />
    </SessionContext.Provider>
  );
}

function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("Session hooks must be used inside <SessionProvider>");
  return ctx;
}

export const useApi = () => useSession().api;

export function useMe() {
  const { me, meStatus, meError, setMe, refreshMe } = useSession();
  return { me, status: meStatus, error: meError, setMe, refresh: refreshMe };
}

/** Spec 14 §4.6: true once an admin endpoint answered mfa_required in this session. */
export const useMfaBlocked = () => useSession().mfaBlocked;

export function useSessionIssue() {
  const { issue, clearIssue } = useSession();
  return { issue, clearIssue };
}
