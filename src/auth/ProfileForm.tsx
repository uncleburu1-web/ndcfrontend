/**
 * Full name + phone form used by /setup-profile and /account (spec §7.3).
 * Errors come straight from the API envelope (`fields`) and show inline.
 */
import { useState, type FormEvent } from "react";
import { Banner, Button, TextField } from "../components/ui";
import { ApiError } from "./api";
import { emitProfileCompleted } from "./events";
import { useApi, useMe, type Me } from "./session";

interface ProfileFormProps {
  submitLabel: string;
  busyLabel: string;
  onSaved?: (me: Me) => void;
  successMessage?: string;
}

export function ProfileForm({ submitLabel, busyLabel, onSaved, successMessage }: ProfileFormProps) {
  const api = useApi();
  const { me, setMe } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<Me>("/me/", {
        method: "PATCH",
        body: { full_name: String(form.get("full_name") ?? ""), phone_number: String(form.get("phone_number") ?? "") },
      });
      if (updated.just_completed) emitProfileCompleted();
      setMe(updated);
      setSaved(true);
      onSaved?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError({}));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (name: string) => error?.fields?.[name]?.[0];
  const formLevel = error && error.code !== "validation_error" ? error.message : null;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
      {formLevel && <Banner tone="error">{formLevel}</Banner>}
      {saved && successMessage && <Banner tone="success">{successMessage}</Banner>}
      <div className="profile-form__fields">
        <TextField
          label="Full name"
          name="full_name"
          required
          autoComplete="name"
          defaultValue={me?.full_name ?? ""}
          hint="First and last name, as people know you."
          error={fieldError("full_name")}
        />
        <TextField
          label="Phone number"
          name="phone_number"
          type="tel"
          required
          defaultValue={me?.phone_number ? me.phone_number.replace(/^\+234/, "0") : ""}
          error={fieldError("phone_number")}
        />
      </div>
      <Button type="submit" loading={busy} loadingLabel={busyLabel} fullWidth>
        {submitLabel}
      </Button>
    </form>
  );
}
