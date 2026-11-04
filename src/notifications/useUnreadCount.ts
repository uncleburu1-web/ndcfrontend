/** Unread notification count — spec 07 §4.8: on load, on navigation, every 2 minutes while the tab is visible. */
import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "../api/typed";
import { useApi } from "../auth/session";

export const POLL_MS = 120_000;

export function useUnreadCount() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!isSignedIn) return;
    apiGet(api, "/me/notifications/unread-count/")
      .then((r) => setUnread(r.unread))
      .catch(() => setUnread(0)); // no badge on failure; retried next time
  }, [api, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setUnread(0); // cleared on sign-out
      return;
    }
    refresh();
  }, [isSignedIn, pathname, refresh]);

  useEffect(() => {
    if (!isSignedIn) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("ndc:notifications-changed", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("ndc:notifications-changed", refresh);
    };
  }, [isSignedIn, refresh]);

  return unread;
}

/** Pages that read or mark notifications call this so the bell updates at once. */
export const notificationsChanged = () => window.dispatchEvent(new Event("ndc:notifications-changed"));
