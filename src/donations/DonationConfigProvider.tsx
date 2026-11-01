/**
 * The backend's compliance gate, read once per session (spec 05 §4.7, §6.6).
 * While it's closed (or unknown), every Donate button stays hidden.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useApi } from "../auth/session";
import type { DonationConfig } from "./types";

const CLOSED: DonationConfig = { open: false, min_kobo: null, max_per_payment_kobo: null, presets_kobo: [] };

interface Value {
  config: DonationConfig;
  loading: boolean;
}

const Ctx = createContext<Value>({ config: CLOSED, loading: false });

export function DonationConfigProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [value, setValue] = useState<Value>({ config: CLOSED, loading: true });
  useEffect(() => {
    let live = true;
    api<DonationConfig>("/donations/config/", { anonymous: true })
      .then((config) => live && setValue({ config, loading: false }))
      .catch(() => live && setValue({ config: CLOSED, loading: false })); // unknown → closed
    return () => {
      live = false;
    };
  }, [api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDonationConfig = () => useContext(Ctx);
