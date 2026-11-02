/** Re-run `refresh` every `ms` while the tab is visible, and when it becomes visible again (spec 11 §4.2). */
import { useEffect } from "react";

export function useAutoRefresh(refresh: () => void, ms = 60_000) {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = window.setInterval(tick, ms);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh, ms]);
}
