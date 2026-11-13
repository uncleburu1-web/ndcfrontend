/**
 * /pvc — Verify your PVC + Get your PVC (spec 06 §4.1; its own unit since spec 08 §4.1).
 * A PVC is needed only for NDC membership — never to browse, follow, donate or read news.
 * Checks are manual: an officer confirms the details on INEC's public voter checker.
 */
import { useAuth } from "@clerk/react";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, CONSENT_DECLINED } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, Checkbox, Select, Skeleton, StatusBadge, Switch, TextField, useToast } from "../../components/ui";
import { STATES } from "../../lib/nigeria";
import { GeoPicker } from "../../geo/GeoPicker";
import { EMPTY_GEO, geoBody, geoFrom, type GeoValue } from "../../geo/types";
import { formatDate } from "../../lib/format";
import type { MyPvc, PvcConfig } from "../../pvc/types";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import "./pvc.css";
import { t } from "../../i18n";

type Errors = Record<string, string>;

function flatten(fields: Record<string, unknown>): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  return out;
}

function VerifyForm({ initial, onDone }: { initial?: MyPvc; onDone: (p: MyPvc) => void }) {
  const api = useApi();
  const [form, setForm] = useState({ vin: "", surname: initial?.surname ?? "", state: initial?.state ?? "", consent: false });
  // Spec 19 §7.2: state and LGA required; ward and polling unit optional
  const [geo, setGeo] = useState<GeoValue>(() => ({
    ...geoFrom(initial?.place, { lga: initial?.lga, polling_unit: initial?.polling_unit }), not_listed: initial?.geo_source === "review",
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      onDone(await api<MyPvc>("/me/pvc/", { method: "PUT", body: { ...form, ...geoBody(geo) } }));
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const f = flatten(e2.fields);
      if (e2.code === "geo_mismatch" || e2.code === "geo_inactive") setErrors({ [String(e2.extra.field ?? "lga").replace(/_id$/, "")]: e2.message });
      else if (Object.keys(f).length) setErrors(f);
      else if (e2.status === 400) setErrors({ vin: e2.message });
      else setFormError(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="pvc-form" onSubmit={submit} noValidate>
      {formError && <Banner tone="error">{formError}</Banner>}
      <TextField label={t("pvc.vin-voter-identification-number")} required value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })}
        hint={t("pvc.19-letters-and-numbers-as-printed")} error={errors.vin} autoComplete="off" />
      <TextField label={t("pvc.surname-as-printed-on-the-card")} required value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })}
        error={errors.surname} />
      <Select label={t("pvc.state-of-registration")} required value={form.state} onChange={(e) => { setForm({ ...form, state: e.target.value }); setGeo(EMPTY_GEO); }}
        error={errors.state} options={[{ value: "", label: t("pvc.choose-a-state") }, ...STATES]} />
      <GeoPicker state={form.state} value={geo} onChange={setGeo} errors={errors} required={["lga"]}
        hint={t("pvc.your-lga-of-registration-ward-and")} />
      <Checkbox required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} error={errors.consent}
        label={t("pvc.ndcconnect-may-check-these-details-on")} />
      <Button type="submit" loading={busy} loadingLabel={t("pvc.sending")}>{t("pvc.send-for-checking")}</Button>
    </form>
  );
}

function GetYourPvc({ config, failed }: { config: PvcConfig | null; failed: boolean }) {
  if (failed) return <p className="pvc-private">{t("pvc.inec-s-links-couldn-t-load")}</p>;
  if (!config) return <Skeleton width="80%" />;
  return (
    <>
      {config.guidance_note && <Banner tone="info">{config.guidance_note}</Banner>}
      <div className="pvc-guide">
        <h3>{t("pvc.collect-your-card")}</h3>
        <p>{config.collection_note || t("pvc.collect-your-card-from-the-inec")}</p>
      </div>
      <div className="pvc-guide">
        <h3>{t("pvc.check-your-registration")}</h3>
        <p>{t("pvc.search-inec-s-voter-register-with")}</p>
        <Button variant="secondary" href={config.inec_voter_check_url} target="_blank" rel="noopener noreferrer">
          {t.rich("pvc.check-on-inec-s-voter-checker", { span: (chunks) => <span className="visually-hidden">{chunks}</span> })}
        </Button>
      </div>
      {config.inec_pvc_url && (
        <div className="pvc-guide">
          <h3>{t("pvc.register-transfer-or-replace")}</h3>
          <p>{t("pvc.new-registration-transfers-and-replacement-cards")}</p>
          <Button variant="secondary" href={config.inec_pvc_url} target="_blank" rel="noopener noreferrer">
            {t.rich("pvc.go-to-inec-s-portal-inec", { span: (chunks) => <span className="visually-hidden">{chunks}</span> })}
          </Button>
        </div>
      )}
      <p className="pvc-private">{t("pvc.ndcconnect-isn-t-inec-only-inec")}</p>
    </>
  );
}

export default function PvcPage() {
  const api = useApi();
  const toast = useToast();
  const { isLoaded, isSignedIn } = useAuth();
  const { refresh } = useMe();
  const config = useRequest("pvc-config", (signal) => api<PvcConfig>("/pvc/config/", { anonymous: true, signal }));
  const [pvc, setPvc] = useState<MyPvc | null>(null);
  const [activeMember, setActiveMember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t("pvc.pvc-ndcconnect");
  }, []);
  useEffect(() => {
    if (!isSignedIn) return;
    setLoading(true);
    api<MyPvc>("/me/pvc/").then(setPvc).catch(() => setPvc(null)).finally(() => setLoading(false));
    api<{ status: string | null }>("/me/membership/").then((m) => setActiveMember(m.status === "active")).catch(() => {});
  }, [api, isSignedIn]);

  const done = (p: MyPvc) => {
    setPvc(p);
    setEditing(false);
    void refresh(); // keeps me.pvc_status (badge, menu, /join) in step
  };
  const withdraw = async () => {
    setBusy(true);
    try {
      await api("/me/pvc/", { method: "DELETE" });
      setPvc({ status: "unverified" });
      void refresh();
    } finally {
      setBusy(false);
    }
  };
  const toggleBadge = async (show: boolean) => {
    try {
      setPvc(await api<MyPvc>("/me/pvc/badge/", { method: "PATCH", body: { show_badge: show } }));
      toast.show({ tone: "success", message: show ? t("pvc.your-verified-voter-badge-will-show") : t("pvc.badge-hidden-from-public-pages") });
    } catch (err) {
      if (err instanceof ApiError && err.code === CONSENT_DECLINED) return; // "Not now": nothing changes (spec 14 §4.2)
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("pvc.couldn-t-change-that") });
    }
  };

  return (
    <div className="pvc-page">
      <header>
        <h1>{t("pvc.your-pvc")}</h1>
        <p className="pvc-page__lead">
          {t("pvc.a-pvc-is-only-needed-to")}</p>
      </header>

      <div className="pvc-grid">
        <section className="pvc-card" aria-labelledby="verify-title">
          <h2 id="verify-title">{t("pvc.verify-your-pvc")}</h2>
          {!isLoaded || loading ? (
            <Skeleton width="80%" />
          ) : !isSignedIn ? (
            <>
              <p>{t("pvc.sign-in-to-verify-your-pvc")}</p>
              <Button href="/sign-in?redirect_url=%2Fpvc">{t("pvc.sign-in")}</Button>
            </>
          ) : !pvc || pvc.status === "unverified" || editing ? (
            <VerifyForm initial={editing ? pvc ?? undefined : undefined} onDone={done} />
          ) : (
            <div className="pvc-status">
              {pvc.status === "successful" ? <VerifiedVoterBadge /> : <StatusBadge set="pvc" status={pvc.status} />}
              {pvc.status === "pending" && (
                <p>
                  {t("pvc.we-re-checking-your-details-on")}</p>
              )}
              {pvc.status === "successful" && <p>{t("pvc.verified", { v: pvc.reviewed_at ? t("pvc.on", { formatDate: formatDate(pvc.reviewed_at) }) : "" })}</p>}
              {pvc.status === "rejected" && <Banner tone="error" title={t("pvc.we-couldn-t-verify-your-pvc")}>{pvc.reason}</Banner>}
              <dl className="pvc-details">
                <div><dt>{t("pvc.vin")}</dt><dd>{pvc.vin_masked}</dd></div>
                <div><dt>{t("pvc.surname")}</dt><dd>{pvc.surname}</dd></div>
                <div><dt>{t("pvc.registered-in")}</dt><dd>{pvc.lga}, {pvc.state_label}</dd></div>
                {pvc.place?.polling_unit && <div><dt>{t("pvc.polling-unit")}</dt><dd>{pvc.place.polling_unit.name} · {pvc.place.polling_unit.code}</dd></div>}
              </dl>
              {pvc.pending_place?.lga && <p className="pvc-private">{t("pvc.your-change-to-waits-for-a", { v: pvc.pending_place.polling_unit?.name ?? pvc.pending_place.lga.name })}</p>}
              <p className="pvc-private">{t("pvc.these-details-are-private-and-encrypted")}</p>
              {pvc.status === "successful" && (
                <Switch label={t("pvc.show-my-verified-voter-badge-publicly")} checked={Boolean(pvc.show_badge)} onChange={(v) => void toggleBadge(v)}
                  hint={t("pvc.only-shown-next-to-your-name")} />
              )}
              <div className="pvc-actions">
                {pvc.status === "pending" && <Button variant="secondary" loading={busy} onClick={() => void withdraw()}>{t("pvc.withdraw")}</Button>}
                {pvc.status === "rejected" && <Button onClick={() => setEditing(true)}>{t("pvc.try-again")}</Button>}
                {pvc.status === "successful" && (
                  <>
                    {!activeMember && <Button href="/join">{t("pvc.continue-to-join-ndc")}</Button>}
                    <Button variant="ghost" onClick={() => setEditing(true)}>{t("pvc.changed-your-registration-submit-new-details")}</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="pvc-card" aria-labelledby="get-title">
          <h2 id="get-title">{t("pvc.get-your-pvc")}</h2>
          <GetYourPvc config={config.data} failed={Boolean(config.error)} />
        </section>
      </div>
    </div>
  );
}
