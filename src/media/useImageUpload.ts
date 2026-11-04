/**
 * One upload path for every public image (spec 15 §7.3, §15.4): candidate photos, campaign post images, community news
 * images and announcement images.
 *
 *   const { upload, progress } = useImageUpload("post_image");
 *   const saved = await upload<CampaignPost>(file, { targetId: post.id, url: `${base}${post.id}/image/`, field: "image" });
 *
 * 1. Type and size are checked here first (JPEG, PNG or WebP; 5 MB), so nothing is sent for a file that will be refused.
 * 2. Django signs one upload for this purpose and target (`POST /media/upload-signature/`).
 * 3. `{"mode": "server"}` (local storage): the file goes to the image endpoint as multipart, as before.
 *    Otherwise the browser sends it straight to Cloudinary with progress, then sends Cloudinary's answer
 *    (`{public_id, version, signature}`) to the image endpoint, which re-checks it before linking.
 * The API secret never reaches the browser; only the signature for this one upload does.
 */
import { useCallback, useState } from "react";
import { ApiError, newRequestId, type ApiRequest } from "../auth/api";
import { apiPost } from "../api/typed";
import { useApi } from "../auth/session";

export type ImagePurpose = "candidate_photo" | "post_image" | "news_image" | "announcement_image";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

interface DirectSignature {
  mode: "direct";
  upload_url: string;
  api_key: string;
  timestamp: number;
  public_id: string;
  upload_preset: string;
  allowed_formats: string;
  signature: string;
  max_bytes?: number;
}
type Signature = DirectSignature | { mode: "server" };

export interface UploadTarget {
  targetId: string;
  /** The image endpoint, e.g. `/admin/candidates/<id>/photo/`. */
  url: string;
  /** The multipart field name: "photo" or "image". */
  field: "photo" | "image";
  rightsConfirmed?: boolean;
}

function invalid(message: string) {
  return new ApiError({ status: 400, code: "invalid_photo", message, fields: {} });
}

export function checkImage(file: File, maxBytes = IMAGE_MAX_BYTES): ApiError | null {
  if (!IMAGE_TYPES.includes(file.type)) return invalid("Use a JPEG, PNG or WebP image.");
  if (file.size > maxBytes) return invalid("That image is larger than 5 MB. Choose a smaller file.");
  return null;
}

/** POST the file to Cloudinary with XHR (fetch has no upload progress). */
export function sendToCloudinary(sig: DirectSignature, file: File, onProgress: (pct: number) => void, timeoutMs = 120_000):
  Promise<{ public_id: string; version: number | string; signature: string }> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    for (const k of ["api_key", "timestamp", "public_id", "upload_preset", "allowed_formats", "signature"] as const) {
      body.append(k, String(sig[k]));
    }
    const xhr = new XMLHttpRequest();
    const rid = newRequestId();
    const fail = (message: string, code = "media_unavailable") =>
      reject(new ApiError({ status: 0, code, request_id: rid, message: `${message} Reference: ${rid.slice(0, 8)}.` }));
    xhr.open("POST", sig.upload_url);
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data: Record<string, unknown> | null = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.public_id && data.signature) {
        onProgress(100);
        resolve({ public_id: String(data.public_id), version: data.version as number, signature: String(data.signature) });
      } else if (xhr.status >= 400 && xhr.status < 500) {
        reject(invalid("That image couldn’t be uploaded. Use a JPEG, PNG or WebP image under 5 MB."));
      } else {
        fail("Image upload isn’t working right now.");
      }
    };
    xhr.onerror = () => fail("Image upload isn’t working right now.");
    xhr.ontimeout = () => fail("The image upload took too long.", "timeout");
    xhr.send(body);
  });
}

export async function uploadImage<T>(api: ApiRequest, purpose: ImagePurpose, file: File, target: UploadTarget,
  onProgress: (pct: number) => void = () => {}): Promise<T> {
  const bad = checkImage(file);
  if (bad) throw bad;
  const sig = (await apiPost(api, "/media/upload-signature/", { purpose, target_id: target.targetId })) as Signature;
  if (sig.mode === "server") {
    const form = new FormData();
    form.append(target.field, file);
    form.append("rights_confirmed", target.rightsConfirmed === false ? "false" : "true");
    return api<T>(target.url, { method: "PUT", body: form });
  }
  if (sig.max_bytes && file.size > sig.max_bytes) throw invalid("That image is larger than 5 MB. Choose a smaller file.");
  const asset = await sendToCloudinary(sig, file, onProgress);
  return api<T>(target.url, { method: "PUT", body: { asset, rights_confirmed: target.rightsConfirmed !== false } });
}

export function useImageUpload(purpose: ImagePurpose) {
  const api = useApi();
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useCallback(async <T,>(file: File, target: UploadTarget): Promise<T> => {
    setProgress(0);
    try {
      return await uploadImage<T>(api, purpose, file, target, setProgress);
    } finally {
      setProgress(null);
    }
  }, [api, purpose]);
  return { upload, progress };
}
