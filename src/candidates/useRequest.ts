import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../auth/api";

interface State<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

/**
 * Run an API request whenever `key` changes; abort the previous one so a slow response
 * for old filters can't overwrite newer results.
 */
export function useRequest<T>(key: string, run: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const runRef = useRef(run);
  runRef.current = run;
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    runRef
      .current(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState({ data: null, error: err instanceof ApiError ? err : new ApiError({}), loading: false });
      });
    return () => controller.abort();
  }, [key, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}
