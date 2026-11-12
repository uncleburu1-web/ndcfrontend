/**
 * Full name + phone form used by /setup-profile and /account (spec §7.3).
 * Errors come straight from the API envelope (`fields`) and show inline.
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Banner, Button, Checkbox, TextField } from "../components/ui";
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
  // Spec 14 §4.3: "I'm 18 or older" until it has been confirmed once.
  const askAge = me ? !me.adult_confirmed : false;
  const [adult, setAdult] = useState(false);
  const [ageError, setAgeError] = useState("");
  const [under18, setUnder18] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (askAge && !adult) {
      setAgeError("Tick this to confirm you’re 18 or older.");
      return;
    }
    setAgeError("");
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<Me>("/me/", {
        method: "PATCH",
        body: {
          full_name: String(form.get("full_name") ?? ""),
          phone_number: String(form.get("phone_number") ?? ""),
          ...(askAge ? { adult_confirmed: true } : {}),
        },
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
        {askAge && (
          <Checkbox
            label="I’m 18 or older"
            name="adult_confirmed"
            required
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            error={ageError || fieldError("adult_confirmed")}
            hint={
              <button type="button" className="profile-form__under18" onClick={() => setUnder18(true)}>
                I’m under 18
              </button>
            }
          />
        )}
      </div>
      {under18 && (
        <Banner tone="info" title="NDCConnect is for voters">
          You need to be 18 or older to use NDCConnect, because it’s for people who can register to vote. You can{" "}
          <Link to="/settings/manage#delete">delete your account</Link> now; nothing else is kept about you.
        </Banner>
      )}
      <Button type="submit" loading={busy} loadingLabel={busyLabel} fullWidth>
        {submitLabel}
      </Button>
    </form>
  );
}
