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
import { t } from "../../i18n";

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
          <span className="visually-hidden">{state === "done" ? t("join.done") : state === "current" ? t("join.current-step") : ""}</span>
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
      toast.show({ tone: "success", message: t("join.details-saved") });
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
      <p className="join-note">{t("join.these-go-on-the-ndc-membership")}</p>
      <TextField label={t("join.full-name-as-on-your-nin")} required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} error={errors.full_name} />
      <RadioGroup legend={t("join.sex")} name="sex" required value={f.sex} onChange={(v) => setF({ ...f, sex: v as "male" | "female" })} error={errors.sex}
        options={[{ value: "female", label: t("join.female") }, { value: "male", label: t("join.male") }]} />
      <label className="join-date">
        <span className="ds-field__label">{t.rich("join.date-of-birth-required", { span: (chunks) => <span className="ds-field__required">{chunks}</span> })}</span>
        <input type="date" className="ds-input" value={f.date_of_birth ?? ""} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })}
          aria-invalid={errors.date_of_birth ? true : undefined} />
        {errors.date_of_birth && <span className="ds-field__error" role="alert">{errors.date_of_birth}</span>}
      </label>
      <TextArea label={t("join.residential-address")} required rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} error={errors.address} />
      <Select label={t("join.state")} required value={f.state} onChange={(e) => { setF({ ...f, state: e.target.value }); setGeo(EMPTY_GEO); }} error={errors.state}
        options={[{ value: "", label: t("join.choose-your-state") }, ...STATES]} />
      <GeoPicker state={f.state} value={geo} onChange={setGeo} errors={errors} required={["lga", "ward", "polling_unit"]}
        hint={t("join.where-you-registered-to-vote-from")} />
      <TextField label="NIN" required inputMode="numeric" autoComplete="off" value={f.nin} onChange={(e) => setF({ ...f, nin: e.target.value })}
        hint={m?.nin_masked ? t("join.saved-enter-it-again-only-to", { nin_masked: m.nin_masked }) : t("join.your-11-digit-national-identification-number")}
        error={errors.nin} />

      <fieldset className="join-photo">
        <legend className="ds-field__label">{t.rich("join.passport-style-photo-required", { span: (chunks) => <span className="ds-field__required">{chunks}</span> })}</legend>
        <p className="join-note">{t("join.a-recent-photo-with-your-face")}</p>
        <div className="join-photo__row">
          {photoUrl ? <img src={photoUrl} alt={t("join.your-membership-photo")} width={96} height={96} className="join-photo__img" /> : <span className="join-photo__empty" aria-hidden="true">{t("join.no-photo")}</span>}
          <div className="join-photo__controls">
            <Checkbox label={t("join.this-is-a-recent-photo-of")} checked={photoConsent}
              onChange={(e) => setPhotoConsent(e.target.checked)} />
            <label className={`ds-button ds-button--secondary ds-button--sm${!photoConsent || photoBusy ? " is-disabled" : ""}`}>
              {photoBusy ? t("join.uploading") : m?.has_photo ? t("join.replace-photo") : t("join.choose-photo")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" disabled={!photoConsent || photoBusy}
                onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        {errors.photo && <p className="ds-field__error" role="alert">{errors.photo}</p>}
      </fieldset>

      <fieldset className="join-declarations">
        <legend className="ds-field__label">{t("join.please-confirm")}</legend>
        {DECLARATIONS.map(([k, label]) => (
          <Checkbox key={k} label={label} required checked={decl[k]} error={errors[`declarations.${k}`]} onChange={(e) => setDecl({ ...decl, [k]: e.target.checked })} />
        ))}
      </fieldset>
      <Button type="submit" variant="secondary" loading={busy} loadingLabel={t("join.saving")}>{t("join.save-details")}</Button>
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
    document.title = t("join.join-ndc-ndcconnect");
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
      setPayError(err instanceof ApiError ? err.message : t("join.payment-couldn-t-start"));
      setPayBusy(false);
      load();
    }
  };
  const cancel = async () => {
    try {
      setM(await api<MyMembership>("/me/membership/cancel/", { method: "POST", body: { reason: cancelReason } }));
      setCancelOpen(false);
      toast.show({ tone: "success", message: t("join.your-membership-has-been-cancelled") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("join.couldn-t-cancel") });
    }
  };

  const intro = (
    <header className="join-hero">
      <div className="join-hero__inner">
        <h1>{t("join.join-the-ndc")}</h1>
        <p>{t("join.become-a-registered-member-of-the")}</p>
        <p className="join-fee">{t.rich("join.membership-fee", { fee, strong: (chunks) => <strong>{chunks}</strong> })}</p>
        <p className="join-hero__small">{t("join.membership-is-private-joining-doesn-t")}</p>
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
            <Step n={1} title={t("join.verify-your-pvc")} state="todo" />
            <Step n={2} title={t("join.your-details")} state="todo" />
            <Step n={3} title={t("join.pay", { fee })} state="todo" />
            <Step n={4} title={t("join.approval")} state="todo" />
          </ol>
          <Button href="/sign-in?redirect_url=%2Fjoin">{t("join.sign-in-to-join")}</Button>
        </div>
      </>
    );
  }

  const settled = status && ["payment_pending", "pending_approval", "active", "rejected", "cancelled", "refunded"].includes(status);
  return (
    <>
      {intro}
      <div className="join-page">
        <p className="join-status">{t.rich("join.status", { DISPLAY_LABELS: DISPLAY_LABELS[display], strong: (chunks) => <strong>{chunks}</strong> })}</p>
        {me && !me.profile_complete && (
          <Banner tone="info" title={t("join.finish-setting-up-your-profile-first")} action={<Button size="sm" href="/setup-profile">{t("join.finish-profile")}</Button>}>
            {t("join.we-need-your-name-and-phone")}</Banner>
        )}
        {!open && <Banner tone="info">{t("join.membership-registration-opens-soon-you-can")}</Banner>}

        {status === "active" && (
          <section className="join-panel join-panel--success" aria-labelledby="active-title">
            <h2 id="active-title">{t("join.you-re-an-ndc-member")}</h2>
            <p>{t.rich("join.membership-number", { membership_number: m?.membership_number, strong: (chunks) => <strong>{chunks}</strong>, v: m?.activated_at ? t("join.since", { formatDate: formatDate(m.activated_at) }) : "" })}</p>
            <div className="join-actions">
              <Button href="/membership/card">{t("join.my-membership-card")}</Button>
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>{t("join.cancel-membership")}</Button>
            </div>
          </section>
        )}
        {status === "pending_approval" && (
          <section className="join-panel" aria-labelledby="pending-title">
            <h2 id="pending-title">{t("join.payment-received-2")}</h2>
            <p>{t("join.your-application-is-with-the-membership-2")}</p>
            <Button variant="ghost" onClick={() => setCancelOpen(true)}>{t("join.cancel-application")}</Button>
          </section>
        )}
        {status === "payment_pending" && (
          <section className="join-panel" aria-labelledby="paying-title">
            <h2 id="paying-title">{t("join.payment-in-progress")}</h2>
            <p>{t("join.we-re-waiting-for-the-bank")}</p>
            {m?.latest_payment && <Button variant="secondary" href={`/join/complete?reference=${m.latest_payment.reference}`}>{t("join.check-payment")}</Button>}
          </section>
        )}
        {status === "rejected" && (
          <Banner tone="error" title={t("join.your-application-wasn-t-approved")}>
            {t("join.you-can-apply-again-below", { decision_reason: m?.decision_reason, v: m?.latest_payment?.status === "successful" && t("join.your-fee-will-be-refunded-to") })}</Banner>
        )}
        {status === "refunded" && <Banner tone="info" title={t("join.refunded")}>{t("join.your-membership-fee-was-refunded-you")}</Banner>}
        {status === "cancelled" && <Banner tone="info" title={t("join.membership-cancelled")}>{t("join.you-can-apply-again-below-2", { cancel_reason: m?.cancel_reason })}</Banner>}

        {(!settled || status === "rejected" || status === "cancelled" || status === "refunded") && (
          <ol className="join-steps">
            <Step n={1} title={t("join.verify-your-pvc")} state={pvcOk ? "done" : "current"}>
              {pvcOk ? <p><VerifiedVoterBadge /></p> : (
                <p>
                  {pvcStatus === "pending" ? t("join.we-re-checking-your-pvc") : pvcStatus === "rejected" ? t("join.we-couldn-t-verify-your-pvc") : t("join.your-pvc-must-be-verified-before")}
                  <Link to="/pvc">{pvcStatus === "pending" ? t("join.see-status") : t("join.verify-your-pvc")}</Link>
                </p>
              )}
            </Step>
            <Step n={2} title={t("join.your-details")} state={complete ? "done" : pvcOk ? "current" : "todo"}>
              {EDITABLE.has(status) && me?.profile_complete ? <DetailsForm m={m} onSaved={setM} /> : null}
            </Step>
            <Step n={3} title={t("join.pay-membership-fee", { fee })} state={pvcOk && complete ? "current" : "todo"}>
              {payError && <Banner tone="error">{payError}</Banner>}
              <Button onClick={() => void pay()} disabled={!open || !pvcOk || !complete} loading={payBusy} loadingLabel={t("join.starting")}>
                {t("join.pay-membership-fee", { fee })}</Button>
              {(!pvcOk || !complete) && <p className="join-note">{t("join.available-once-your-pvc-is-verified")}</p>}
            </Step>
            <Step n={4} title={t("join.approval")} state="todo">
              <p>{config.data?.requires_approval ? t("join.the-membership-team-reviews-your-application") : t("join.you-become-a-member-as-soon")}</p>
            </Step>
          </ol>
        )}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t("join.cancel-your-membership")}
        footer={<><Button variant="secondary" onClick={() => setCancelOpen(false)}>{t("join.keep-membership")}</Button><Button variant="danger" onClick={() => void cancel()} disabled={!cancelReason.trim()}>{t("join.cancel-membership")}</Button></>}>
        <p>{t("join.you-ll-be-removed-from-future", { v: status === "active" ? t("join.the-membership-fee-isn-t-refunded") : "" })}</p>
        <TextArea label={t("join.reason")} required rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </Modal>
    </>
  );
}
