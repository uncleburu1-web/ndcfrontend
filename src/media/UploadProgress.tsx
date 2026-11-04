/** "Uploading image… 45%" while useImageUpload runs (spec 15 §15.4). */
export function UploadProgress({ progress }: { progress: number | null }) {
  if (progress === null) return null;
  return (
    <p className="ds-field__hint" role="status" aria-live="polite">
      {progress > 0 && progress < 100 ? `Uploading image… ${progress}%` : progress >= 100 ? "Saving image…" : "Preparing upload…"}
    </p>
  );
}
