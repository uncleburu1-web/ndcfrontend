/**
 * Cached, anonymous geography lookups (spec 19 §13.1). The lists are public reference data, so one fetch per list is
 * kept for the session (the backend's ETag and an hour's cache cover the rest).
 */
import { useEffect, useState } from "react";
import type { ApiRequest } from "../auth/api";
import { useApi } from "../auth/session";
import type { GeoConstituency, GeoLga, GeoUnit, GeoUnitDetail, GeoWard } from "./types";

const cache = new Map<string, Promise<unknown>>();

function cached<T>(api: ApiRequest, path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = Promise.resolve(api<{ results: T }>(path, { anonymous: true })).then((r) => (Array.isArray(r?.results) ? r.results : ([] as unknown as T)));
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

/** Tests reset the cache between cases. */
export function clearGeoCache() {
  cache.clear();
}

export const geoApi = {
  lgas: (api: ApiRequest, state: string) => cached<GeoLga[]>(api, `/geo/states/${encodeURIComponent(state)}/lgas/`),
  wards: (api: ApiRequest, lga: number) => cached<GeoWard[]>(api, `/geo/lgas/${lga}/wards/`),
  units: (api: ApiRequest, ward: number) => cached<GeoUnit[]>(api, `/geo/wards/${ward}/polling-units/`),
  constituencies: (api: ApiRequest, state: string, kind: string) =>
    cached<GeoConstituency[]>(api, `/geo/constituencies/?state=${encodeURIComponent(state)}&kind=${kind}`),
  byCode: (api: ApiRequest, code: string) => api<GeoUnitDetail>(`/geo/polling-units/${encodeURIComponent(code)}/`, { anonymous: true }),
};

interface Loaded<T> {
  data: T[];
  loading: boolean;
  error: boolean;
}

/** One list for a parent; empty while there's no parent. */
export function useGeoList<T>(load: ((api: ApiRequest) => Promise<T[]>) | null, key: string): Loaded<T> {
  const api = useApi();
  const [state, setState] = useState<Loaded<T>>({ data: [], loading: false, error: false });
  useEffect(() => {
    if (!load) {
      setState({ data: [], loading: false, error: false });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    load(api).then(
      (data) => live && setState({ data, loading: false, error: false }),
      () => live && setState({ data: [], loading: false, error: true }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Folded, lower-case text for client-side filtering ("Ọ̀yọ́" ~ "oyo"). */
export function fold(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export const CODE_RE = /^\d{2}-\d{2}-\d{2}-\d{3}$/;
