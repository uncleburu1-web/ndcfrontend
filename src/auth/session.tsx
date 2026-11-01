/**
 * Session state shared across the app:
 * - `useApi()`  — the API client wired to Clerk's getToken (spec §7.5)
 * - `useMe()`   — the caller's NDCConnect profile from GET /me
 * - banners for "session ended" and "sign-in unavailable"
 */
import { useAuth, useClerk } from "@clerk/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createApiClient, type ApiRequest } from "./api";

export interface Me {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  profile_complete: boolean;
  roles: { id: string; role: string; scope_type: string; scope_id: string | null }[];
  is_system_admin: boolean;
  just_completed?: boolean;
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

  // One API client for the whole session. Clerk's getToken and React Router's navigate can change
  // identity between renders (navigate does on every route change); reading them through refs keeps
  // `api` stable, so effects that depend on it don't re-run or restart in-flight requests.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
        getToken: (o) => getTokenRef.current(o),
        onSessionEnded: () => setIssue("session-ended"),
        onAuthUnavailable: () => setIssue("auth-unavailable"),
        onDeactivated: () => {
          setMe(null);
          void signOutRef.current({ redirectUrl: "/account-deactivated" });
          navigateRef.current("/account-deactivated", { replace: true });
        },
      }),
    []
  );

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

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) void refreshMe();
    else {
      setMe(null);
      setMeStatus("idle");
    }
  }, [isLoaded, isSignedIn, refreshMe]);

  const value = useMemo<SessionContextValue>(
    () => ({ api, me, meStatus, meError, setMe, refreshMe, issue, clearIssue: () => setIssue(null) }),
    [api, me, meStatus, meError, refreshMe, issue]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
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

export function useSessionIssue() {
  const { issue, clearIssue } = useSession();
  return { issue, clearIssue };
}
