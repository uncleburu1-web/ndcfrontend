/**
 * /join — NDC membership (spec 06 §4.2). Public intro; applying needs sign-in and a completed profile.
 * Steps: verify PVC → your details (Electoral Act 2026 s. 77(2)) → pay ₦20,000 → approval (when on).
 */
import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, Checkbox, Modal, RadioGroup, Select, Skeleton, TextArea, TextField, useToast } from "../../components/ui";
import { formatKobo } from "../../donations/money";
import { redirectTo } from "../../donations/navigation";
import { formatDate } from "../../lib/format";
import { GeoPicker } from "../../geo/GeoPicker";
import { EMPTY_GEO, geoBody, geoFrom, type GeoValue } from "../../geo/types";
import { STATES } from "../../lib/nigeria";
import { useAuthedImage } from "../../membership/useAuthedImage";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import { DISPLAY_LABELS, type MembershipConfig, type MyMembership } from "../../membership/types";
import "./join.css";

type Errors = Record<string, string>;
const DECLARATIONS = [
  ["no_other_party", "I’m not a member of any other political party."],
  ["constitution", "I agree to abide by the NDC constitution."],
  ["data_processing", "I agree that NDCConnect and the NDC may process these details, including my NIN and photo, to keep the party’s membership register and submit it to INEC as the Electoral Act 2026 requires."],
] as const;
const EDITABLE = new Set([null, "draft", "rejected", "cancelled", "refunded"]);

function flatten(fields: Record<string, unknown>, prefix = ""): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[key] = String(v[0]);
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
    else if (v) out[key] = String(v);
  }
  return out;
}

function detailsComplete(m: MyMembership | null) {
  if (!m) return false;
  const req = [m.full_name, m.sex, m.date_of_birth, m.address, m.state, m.lga, m.ward, m.polling_unit, m.nin_masked];
  return req.every(Boolean) && Boolean(m.has_photo) && DECLARATIONS.every(([k]) => m.declarations?.[k] === true);
}

function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "current" | "todo"; children?: React.ReactNode }) {
  return (
    <li className={`join-step join-step--${state}`}>
      <span className="join-step__marker" aria-hidden="true">{state === "done" ? "✓" : n}</span>
      <div className="join-step__body">
        <h3>
          {title}
          <span className="visually-hidden">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
        </h3>
        {children}
      </div>
    </li>
  );
}

function DetailsForm({ m, onSaved }: { m: MyMembership | null; onSaved: (m: MyMembership) => void }) {
  const api = useApi();
  const toast = useToast();
  const [f, setF] = useState({
    full_name: m?.full_name ?? "", sex: m?.sex ?? "", date_of_birth: m?.date_of_birth ?? "", address: m?.address ?? "",
    state: m?.state ?? "", nin: "",
  });
  // Spec 19 §7.2: the location comes from INEC's list (IDs); "not listed" keeps the typed text for an officer
  const [geo, setGeo] = useState<GeoValue>(() => ({
    ...geoFrom(m?.place, { lga: m?.lga, ward: m?.ward, polling_unit: m?.polling_unit }), not_listed: m?.geo_source === "review",
  }));
  const [decl, setDecl] = useState<Record<string, boolean>>(
    Object.fromEntries(DECLARATIONS.map(([k]) => [k, m?.declarations?.[k] === true])));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const photoUrl = useAuthedImage(m?.has_photo ? "/me/membership/photo/" : null, photoVersion);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body: Record<string, unknown> = { ...f, ...geoBody(geo), date_of_birth: f.date_of_birth || null, declarations: decl };
      if (!f.nin) delete body.nin;
      const saved = await api<MyMembership>("/me/membership/", { method: "PUT", body });
      setF((x) => ({ ...x, nin: "" }));
      onSaved(saved);
      toast.show({ tone: "success", message: "Details saved." });
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const flat = flatten(e2.fields);
      if (e2.code === "under_18") flat.date_of_birth = e2.message;
      if (e2.code === "geo_mismatch" || e2.code === "geo_inactive") flat[String(e2.extra.field ?? "lga").replace(/_id$/, "")] = e2.message;
      if (!Object.keys(flat).length && e2.status === 400) flat.nin = e2.message;
      setErrors(Object.keys(flat).length ? flat : { _form: e2.message });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setErrors((x) => ({ ...x, photo: "" }));
    try {
      const form = new FormData();
      form.append("photo", file);
      form.append("consent", String(photoConsent));
      onSaved(await api<MyMembership>("/me/membership/photo/", { method: "PUT", body: form }));
      setPhotoVersion((v) => v + 1);
    } catch (err) {
      setErrors((x) => ({ ...x, photo: err instanceof ApiError ? err.message : "Upload failed." }));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <form className="join-form" onSubmit={save} noValidate>
      {errors._form && <Banner tone="error">{errors._form}</Banner>}
      <p className="join-note">These go on the NDC membership register the law requires (Electoral Act 2026 s. 77). They’re private.</p>
      <TextField label="Full name (as on your NIN)" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} error={errors.full_name} />
      <RadioGroup legend="Sex" name="sex" required value={f.sex} onChange={(v) => setF({ ...f, sex: v as "male" | "female" })} error={errors.sex}
        options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} />
      <label className="join-date">
        <span className="ds-field__label">Date of birth <span className="ds-field__required">(required)</span></span>
        <input type="date" className="ds-input" value={f.date_of_birth ?? ""} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })}
          aria-invalid={errors.date_of_birth ? true : undefined} />
        {errors.date_of_birth && <span className="ds-field__error" role="alert">{errors.date_of_birth}</span>}
      </label>
      <TextArea label="Residential address" required rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} error={errors.address} />
      <Select label="State" required value={f.state} onChange={(e) => { setF({ ...f, state: e.target.value }); setGeo(EMPTY_GEO); }} error={errors.state}
        options={[{ value: "", label: "Choose your state" }, ...STATES]} />
      <GeoPicker state={f.state} value={geo} onChange={setGeo} errors={errors} required={["lga", "ward", "polling_unit"]}
        hint="Where you registered to vote, from INEC’s list." />
      <TextField label="NIN" required inputMode="numeric" autoComplete="off" value={f.nin} onChange={(e) => setF({ ...f, nin: e.target.value })}
        hint={m?.nin_masked ? `Saved: ${m.nin_masked}. Enter it again only to change it.` : "Your 11-digit National Identification Number. Stored encrypted."}
        error={errors.nin} />

      <fieldset className="join-photo">
        <legend className="ds-field__label">Passport-style photo <span className="ds-field__required">(required)</span></legend>
        <p className="join-note">A recent photo with your face clearly visible. JPEG, PNG or WebP, up to 5 MB, at least 400 × 400 px. Location data is removed.</p>
        <div className="join-photo__row">
          {photoUrl ? <img src={photoUrl} alt="Your membership photo" width={96} height={96} className="join-photo__img" /> : <span className="join-photo__empty" aria-hidden="true">No photo</span>}
          <div className="join-photo__controls">
            <Checkbox label="This is a recent photo of me that the NDC may use on my membership card and register." checked={photoConsent}
              onChange={(e) => setPhotoConsent(e.target.checked)} />
            <label className={`ds-button ds-button--secondary ds-button--sm${!photoConsent || photoBusy ? " is-disabled" : ""}`}>
              {photoBusy ? "Uploading…" : m?.has_photo ? "Replace photo" : "Choose photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={!photoConsent || photoBusy}
                onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        {errors.photo && <p className="ds-field__error" role="alert">{errors.photo}</p>}
      </fieldset>

      <fieldset className="join-declarations">
        <legend className="ds-field__label">Please confirm</legend>
        {DECLARATIONS.map(([k, label]) => (
          <Checkbox key={k} label={label} required checked={decl[k]} error={errors[`declarations.${k}`]} onChange={(e) => setDecl({ ...decl, [k]: e.target.checked })} />
        ))}
      </fieldset>
      <Button type="submit" variant="secondary" loading={busy} loadingLabel="Saving…">Save details</Button>
    </form>
  );
}

export default function JoinPage() {
  const api = useApi();
  const toast = useToast();
  const { isLoaded, isSignedIn } = useAuth();
  const { me } = useMe();
  const config = useRequest("membership-config", (signal) => api<MembershipConfig>("/membership/config/", { anonymous: true, signal }));
  const [m, setM] = useState<MyMembership | null>(null);
  const [loading, setLoading] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    document.title = "Join NDC | NDCConnect";
  }, []);
  const load = useCallback(() => {
    setLoading(true);
    api<MyMembership>("/me/membership/")
      .then(setM)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);
  useEffect(() => {
    if (isSignedIn) load();
  }, [isSignedIn, load]);

  const fee = config.data ? formatKobo(config.data.fee_kobo) : "₦20,000";
  const open = Boolean(config.data?.open);
  // Spec 08 §6.2: step 1 reads the caller's PVC status from /me (PVC is its own unit; no separate request).
  const pvcStatus = me?.pvc_status ?? "unverified";
  const pvcOk = pvcStatus === "successful";
  const complete = detailsComplete(m);
  const status = m?.status ?? null;
  const display = m?.display_status ?? "not_joined";

  const pay = async () => {
    setPayBusy(true);
    setPayError("");
    try {
      const r = await api<{ reference: string; checkout_url: string }>("/me/membership/pay/", { method: "POST" });
      redirectTo(r.checkout_url);
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Payment couldn’t start.");
      setPayBusy(false);
      load();
    }
  };
  const cancel = async () => {
    try {
      setM(await api<MyMembership>("/me/membership/cancel/", { method: "POST", body: { reason: cancelReason } }));
      setCancelOpen(false);
      toast.show({ tone: "success", message: "Your membership has been cancelled." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t cancel." });
    }
  };

  const intro = (
    <header className="join-hero">
      <div className="join-hero__inner">
        <h1>Join the NDC</h1>
        <p>Become a registered member of the Nigeria Democratic Congress: take part in party life and be on the register for primaries and congresses.</p>
        <p className="join-fee">Membership fee <strong>{fee}</strong></p>
        <p className="join-hero__small">Membership is private. Joining doesn’t follow a candidate or count as a donation.</p>
      </div>
    </header>
  );

  if (!isLoaded || (isSignedIn && loading && !m)) {
    return <>{intro}<div className="join-page"><Skeleton width="60%" /></div></>;
  }
  if (!isSignedIn) {
    return (
      <>
        {intro}
        <div className="join-page">
          <ol className="join-steps join-steps--plain">
            <Step n={1} title="Verify your PVC" state="todo" />
            <Step n={2} title="Your details" state="todo" />
            <Step n={3} title={`Pay ${fee}`} state="todo" />
            <Step n={4} title="Approval" state="todo" />
          </ol>
          <Button href="/sign-in?redirect_url=%2Fjoin">Sign in to join</Button>
        </div>
      </>
    );
  }

  const settled = status && ["payment_pending", "pending_approval", "active", "rejected", "cancelled", "refunded"].includes(status);
  return (
    <>
      {intro}
      <div className="join-page">
        <p className="join-status">Status: <strong>{DISPLAY_LABELS[display]}</strong></p>
        {me && !me.profile_complete && (
          <Banner tone="info" title="Finish setting up your profile first" action={<Button size="sm" href="/setup-profile">Finish profile</Button>}>
            We need your name and phone number before you can apply.
          </Banner>
        )}
        {!open && <Banner tone="info">Membership registration opens soon. You can verify your PVC and save your details now.</Banner>}

        {status === "active" && (
          <section className="join-panel join-panel--success" aria-labelledby="active-title">
            <h2 id="active-title">You’re an NDC member</h2>
            <p>Membership number <strong>{m?.membership_number}</strong>{m?.activated_at ? ` · since ${formatDate(m.activated_at)}` : ""}</p>
            <div className="join-actions">
              <Button href="/membership/card">My membership card</Button>
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>Cancel membership</Button>
            </div>
          </section>
        )}
        {status === "pending_approval" && (
          <section className="join-panel" aria-labelledby="pending-title">
            <h2 id="pending-title">Payment received</h2>
            <p>Your application is with the membership team. We’ll update this page when it’s decided.</p>
            <Button variant="ghost" onClick={() => setCancelOpen(true)}>Cancel application</Button>
          </section>
        )}
        {status === "payment_pending" && (
          <section className="join-panel" aria-labelledby="paying-title">
            <h2 id="paying-title">Payment in progress</h2>
            <p>We’re waiting for the bank to confirm your payment.</p>
            {m?.latest_payment && <Button variant="secondary" href={`/join/complete?reference=${m.latest_payment.reference}`}>Check payment</Button>}
          </section>
        )}
        {status === "rejected" && (
          <Banner tone="error" title="Your application wasn’t approved">
            {m?.decision_reason} {m?.latest_payment?.status === "successful" && "Your fee will be refunded to your original payment method."} You can apply again below.
          </Banner>
        )}
        {status === "refunded" && <Banner tone="info" title="Refunded">Your membership fee was refunded. You can apply again below.</Banner>}
        {status === "cancelled" && <Banner tone="info" title="Membership cancelled">{m?.cancel_reason} You can apply again below.</Banner>}

        {(!settled || status === "rejected" || status === "cancelled" || status === "refunded") && (
          <ol className="join-steps">
            <Step n={1} title="Verify your PVC" state={pvcOk ? "done" : "current"}>
              {pvcOk ? <p><VerifiedVoterBadge /></p> : (
                <p>
                  {pvcStatus === "pending" ? "We’re checking your PVC. " : pvcStatus === "rejected" ? "We couldn’t verify your PVC. " : "Your PVC must be verified before you can pay. "}
                  <Link to="/pvc">{pvcStatus === "pending" ? "See status" : "Verify your PVC"}</Link>
                </p>
              )}
            </Step>
            <Step n={2} title="Your details" state={complete ? "done" : pvcOk ? "current" : "todo"}>
              {EDITABLE.has(status) && me?.profile_complete ? <DetailsForm m={m} onSaved={setM} /> : null}
            </Step>
            <Step n={3} title={`Pay ${fee} membership fee`} state={pvcOk && complete ? "current" : "todo"}>
              {payError && <Banner tone="error">{payError}</Banner>}
              <Button onClick={() => void pay()} disabled={!open || !pvcOk || !complete} loading={payBusy} loadingLabel="Starting…">
                Pay {fee} membership fee
              </Button>
              {(!pvcOk || !complete) && <p className="join-note">Available once your PVC is verified and your details are complete.</p>}
            </Step>
            <Step n={4} title="Approval" state="todo">
              <p>{config.data?.requires_approval ? "The membership team reviews your application after payment." : "You become a member as soon as payment is confirmed."}</p>
            </Step>
          </ol>
        )}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your membership?"
        footer={<><Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep membership</Button><Button variant="danger" onClick={() => void cancel()} disabled={!cancelReason.trim()}>Cancel membership</Button></>}>
        <p>You’ll be removed from future registers. {status === "active" ? "The membership fee isn’t refunded once you’re active." : ""}</p>
        <TextArea label="Reason" required rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </Modal>
    </>
  );
}
