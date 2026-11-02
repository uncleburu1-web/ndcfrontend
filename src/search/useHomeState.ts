/**
 * Home state as a default filter (spec 12 §4.5). Only pre-fills; the page says so with a chip, and
 * clearing it is remembered for this browser session only (never sent to the server).
 */
import { useCallback, useState } from "react";
import { useMe } from "../auth/session";

const KEY = "ndc_home_state_off";

function readOff() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useHomeState(paramState: string) {
  const { me } = useMe();
  const [off, setOff] = useState(readOff);
  const home = me?.home_state ?? "";
  const fromHome = !paramState && Boolean(home) && !off;
  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* storage can be unavailable; the in-memory flag still works */
    }
    setOff(true);
  }, []);
  return { state: paramState || (fromHome ? home : ""), fromHome, home, dismiss };
}
