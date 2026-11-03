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
import { formatDate } from "../../lib/format";
import type { MyPvc, PvcConfig } from "../../pvc/types";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import "./pvc.css";

type Errors = Record<string, string>;

function flatten(fields: Record<string, unknown>): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  return out;
}

function VerifyForm({ initial, onDone }: { initial?: MyPvc; onDone: (p: MyPvc) => void }) {
  const api = useApi();
  const [form, setForm] = useState({ vin: "", surname: initial?.surname ?? "", state: initial?.state ?? "", lga: initial?.lga ?? "",
    polling_unit: initial?.polling_unit ?? "", consent: false });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      onDone(await api<MyPvc>("/me/pvc/", { method: "PUT", body: form }));
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const f = flatten(e2.fields);
      if (Object.keys(f).length) setErrors(f);
      else if (e2.status === 400) setErrors({ vin: e2.message });
      else setFormError(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="pvc-form" onSubmit={submit} noValidate>
      {formError && <Banner tone="error">{formError}</Banner>}
      <TextField label="VIN (Voter Identification Number)" required value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })}
        hint="19 letters and numbers as printed on your card, or the last 10." error={errors.vin} autoComplete="off" />
      <TextField label="Surname as printed on the card" required value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })}
        error={errors.surname} />
      <Select label="State of registration" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
        error={errors.state} options={[{ value: "", label: "Choose a state" }, ...STATES]} />
      <TextField label="LGA of registration" required value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} error={errors.lga} />
      <TextField label="Polling unit (optional)" value={form.polling_unit} onChange={(e) => setForm({ ...form, polling_unit: e.target.value })} />
      <Checkbox required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} error={errors.consent}
        label="NDCConnect may check these details on INEC’s voter register to confirm my registration." />
      <Button type="submit" loading={busy} loadingLabel="Sending…">Send for checking</Button>
    </form>
  );
}

function GetYourPvc({ config, failed }: { config: PvcConfig | null; failed: boolean }) {
  if (failed) return <p className="pvc-private">INEC’s links couldn’t load. Visit inecnigeria.org.</p>;
  if (!config) return <Skeleton width="80%" />;
  return (
    <>
      {config.guidance_note && <Banner tone="info">{config.guidance_note}</Banner>}
      <div className="pvc-guide">
        <h3>Collect your card</h3>
        <p>{config.collection_note || "Collect your card from the INEC office where you registered."}</p>
      </div>
      <div className="pvc-guide">
        <h3>Check your registration</h3>
        <p>Search INEC’s voter register with your VIN, or your name and date of birth.</p>
        <Button variant="secondary" href={config.inec_voter_check_url} target="_blank" rel="noopener noreferrer">
          Check on INEC’s voter checker<span className="visually-hidden"> (INEC’s site, opens in a new tab)</span>
        </Button>
      </div>
      {config.inec_pvc_url && (
        <div className="pvc-guide">
          <h3>Register, transfer or replace</h3>
          <p>New registration, transfers and replacement cards are handled by INEC.</p>
          <Button variant="secondary" href={config.inec_pvc_url} target="_blank" rel="noopener noreferrer">
            Go to INEC’s portal<span className="visually-hidden"> (INEC’s site, opens in a new tab)</span>
          </Button>
        </div>
      )}
      <p className="pvc-private">NDCConnect isn’t INEC. Only INEC issues and replaces PVCs.</p>
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
    document.title = "PVC | NDCConnect";
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
      toast.show({ tone: "success", message: show ? "Your Verified voter badge will show beside your name where it’s public." : "Badge hidden from public pages." });
    } catch (err) {
      if (err instanceof ApiError && err.code === CONSENT_DECLINED) return; // "Not now": nothing changes (spec 14 §4.2)
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t change that." });
    }
  };

  return (
    <div className="pvc-page">
      <header>
        <h1>Your PVC</h1>
        <p className="pvc-page__lead">
          A PVC is only needed to join the NDC. You never need one to browse, vote (follow) candidates, donate or read news.
        </p>
      </header>

      <div className="pvc-grid">
        <section className="pvc-card" aria-labelledby="verify-title">
          <h2 id="verify-title">Verify your PVC</h2>
          {!isLoaded || loading ? (
            <Skeleton width="80%" />
          ) : !isSignedIn ? (
            <>
              <p>Sign in to verify your PVC.</p>
              <Button href="/sign-in?redirect_url=%2Fpvc">Sign in</Button>
            </>
          ) : !pvc || pvc.status === "unverified" || editing ? (
            <VerifyForm initial={editing ? pvc ?? undefined : undefined} onDone={done} />
          ) : (
            <div className="pvc-status">
              {pvc.status === "successful" ? <VerifiedVoterBadge /> : <StatusBadge set="pvc" status={pvc.status} />}
              {pvc.status === "pending" && (
                <p>
                  We’re checking your details on INEC’s voter register. This is done by a person and usually takes up to 3 working days.
                  We’ll send you a notification when it’s done.
                </p>
              )}
              {pvc.status === "successful" && <p>Verified{pvc.reviewed_at ? ` on ${formatDate(pvc.reviewed_at)}` : ""}.</p>}
              {pvc.status === "rejected" && <Banner tone="error" title="We couldn’t verify your PVC">{pvc.reason}</Banner>}
              <dl className="pvc-details">
                <div><dt>VIN</dt><dd>{pvc.vin_masked}</dd></div>
                <div><dt>Surname</dt><dd>{pvc.surname}</dd></div>
                <div><dt>Registered in</dt><dd>{pvc.lga}, {pvc.state_label}</dd></div>
              </dl>
              <p className="pvc-private">These details are private and encrypted.</p>
              {pvc.status === "successful" && (
                <Switch label="Show my Verified voter badge publicly" checked={Boolean(pvc.show_badge)} onChange={(v) => void toggleBadge(v)}
                  hint="Only shown next to your name where your name is already public, such as news you chose to sign with your name." />
              )}
              <div className="pvc-actions">
                {pvc.status === "pending" && <Button variant="secondary" loading={busy} onClick={() => void withdraw()}>Withdraw</Button>}
                {pvc.status === "rejected" && <Button onClick={() => setEditing(true)}>Try again</Button>}
                {pvc.status === "successful" && (
                  <>
                    {!activeMember && <Button href="/join">Continue to Join NDC</Button>}
                    <Button variant="ghost" onClick={() => setEditing(true)}>Changed your registration? Submit new details</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="pvc-card" aria-labelledby="get-title">
          <h2 id="get-title">Get your PVC</h2>
          <GetYourPvc config={config.data} failed={Boolean(config.error)} />
        </section>
      </div>
    </div>
  );
}
