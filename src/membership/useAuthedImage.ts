/** Private photos need the Bearer token, so they're fetched as blobs, not <img src> (spec 06 §9). */
import { useEffect, useState } from "react";
import { useApi } from "../auth/session";

export function useAuthedImage(path: string | null, version: unknown = 0) {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let live = true;
    let objectUrl: string | null = null;
    api<Blob>(path, { responseType: "blob" })
      .then((blob) => {
        if (!live) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, path, version]);
  return url;
}
