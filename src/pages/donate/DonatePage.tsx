/**
 * /donate — spec 05 §4.1. Guests welcome; signed-in donors get their details prefilled.
 * The money moves on the provider's hosted checkout, never here (§3.8).
 */
import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { usePreferences } from "../../settings/PreferencesProvider";
import { useApi, useMe } from "../../auth/session";
import type { CandidateProfile, CandidateSummary, Paginated } from "../../candidates/types";
import { AmountPicker, Banner, Button, Checkbox, EmptyState, RadioGroup, Select, Skeleton, TextArea, TextField } from "../../components/ui";
import { useDonationConfig } from "../../donations/DonationConfigProvider";
import { nairaToKobo } from "../../donations/money";
import { redirectTo } from "../../donations/navigation";
import { formatNaira } from "../../lib/format";
import { STATES } from "../../lib/nigeria";
import "./donate.css";
import { t as tr } from "../../i18n";

type Fields = Record<string, string>;
const DECLARATIONS = [
  ["own_funds", "I’m donating my own money."],
  ["nigerian_source", "I’m a Nigerian citizen or resident, and this money doesn’t come from outside Nigeria."],
  ["voluntary", "I understand donations are voluntary and don’t affect my vote or membership."],
] as const;

/** DRF nested errors arrive as {declarations: {own_funds: [...]}}; flatten to "declarations.own_funds". */
function flatten(fields: Record<string, unknown>, prefix = ""): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[key] = String(v[0]);
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
    else if (v) out[key] = String(v);
  }
  return out;
}

export default function DonatePage() {
  const api = useApi();
  const { config, loading: configLoading } = useDonationConfig();
  const { isSignedIn } = useAuth();
  const { me } = useMe();
  const [params] = useSearchParams();
  const presetSlug = params.get("candidate") ?? "";
  const presetAmount = Number(params.get("amount") ?? "") || null;

  const [amount, setAmount] = useState<number | null>(presetAmount);
  const [designation, setDesignation] = useState<"party" | "candidate">(presetSlug ? "candidate" : "party");
  const [candidate, setCandidate] = useState<{ slug: string; full_name: string } | null>(null);
  const [candidateNotice, setCandidateNotice] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CandidateSummary[]>([]);
  const [donor, setDonor] = useState({ name: "", email: "", phone: "", state: "", address: "" });
  const [display, setDisplay] = useState<"name" | "anonymous">("name");
  const [displayTouched, setDisplayTouched] = useState(false);
  const { settings, loadSettings, signedIn } = usePreferences();
  const [declared, setDeclared] = useState({ own_funds: false, nigerian_source: false, voluntary: false });
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = tr("donate.donate-ndcconnect");
  }, []);

  // Prefill from the signed-in profile, without overwriting what the donor typed.
  useEffect(() => {
    if (!me) return;
    setDonor((d) => ({
      ...d,
      name: d.name || me.full_name,
      email: d.email || me.email,
      phone: d.phone || me.phone_number.replace(/^\+234/, "0"),
    }));
  }, [me]);

  // Spec 20 §8: the person's default only pre-selects the choice; they still choose on each donation.
  useEffect(() => {
    if (signedIn && !settings) void loadSettings();
  }, [signedIn, settings, loadSettings]);
  const defaultName = settings?.privacy.donation_name_default;
  useEffect(() => {
    if (defaultName && !displayTouched) setDisplay(defaultName);
  }, [defaultName, displayTouched]);

  // ?candidate=<slug> preselects; unknown/unpublished falls back to the NDC fund with a notice.
  useEffect(() => {
    if (!presetSlug) return;
    api<CandidateProfile>(`/candidates/${encodeURIComponent(presetSlug)}/`, { anonymous: true })
      .then((c) => setCandidate({ slug: c.slug, full_name: c.full_name }))
      .catch(() => {
        setDesignation("party");
        setCandidateNotice(tr("donate.that-candidate-isn-t-available-for"));
      });
  }, [api, presetSlug]);

  // Candidate search (debounced).
  useEffect(() => {
    if (designation !== "candidate" || candidate) return;
    const q = search.trim();
    const t = window.setTimeout(() => {
      api<Paginated<CandidateSummary>>(`/candidates/${q ? `?q=${encodeURIComponent(q)}` : ""}`, { anonymous: true })
        .then((r) => setResults(r.results.slice(0, 8)))
        .catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [api, designation, candidate, search]);

  const presets = useMemo(() => config.presets_kobo.map((k) => k / 100), [config.presets_kobo]);
  const min = (config.min_kobo ?? 0) / 100;
  const max = (config.max_per_payment_kobo ?? 0) / 100;

  if (configLoading) {
    return (
      <div className="donate-page" aria-busy="true">
        <span className="visually-hidden">{tr("donate.loading")}</span>
        <Skeleton width="40%" height={36} />
        <Skeleton width="80%" />
      </div>
    );
  }
  if (!config.open) {
    return (
      <div className="page-shell">
        <EmptyState title={tr("donate.donations-aren-t-open-yet")} action={<Button href="/candidates">{tr("donate.see-candidates")}</Button>}>
          {tr("donate.you-can-still-vote-follow-candidates")}</EmptyState>
      </div>
    );
  }

  const target = designation === "candidate" && candidate ? `${candidate.full_name}'s campaign` : "the NDC general fund";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Fields = {};
    if (amount === null || amount <= 0) local.amount_kobo = "Choose or enter an amount.";
    else if (amount < min || amount > max) local.amount_kobo = `Give between ${formatNaira(min)} and ${formatNaira(max)} in one payment.`;
    if (designation === "candidate" && !candidate) local.candidate_slug = "Choose a candidate.";
    for (const [k] of DECLARATIONS) if (!declared[k]) local[`declarations.${k}`] = "Tick this to continue.";
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const res = await api<{ reference: string; checkout_url: string }>("/donations/", {
        method: "POST",
        anonymous: !isSignedIn,
        body: {
          amount_kobo: nairaToKobo(amount!),
          designation,
          candidate_slug: designation === "candidate" ? candidate?.slug : "",
          donor_name: donor.name,
          donor_email: donor.email,
          donor_phone: donor.phone,
          donor_state: donor.state,
          donor_address: donor.address,
          display_choice: isSignedIn ? display : undefined,
          declarations: declared,
        },
      });
      redirectTo(res.checkout_url);
    } catch (err) {
      const e2 = err instanceof ApiError ? err : new ApiError({});
      const flat = flatten(e2.fields);
      if (e2.code === "over_limit" || e2.code === "amount_out_of_range") flat.amount_kobo = e2.message;
      if (e2.code === "candidate_unavailable") flat.candidate_slug = e2.message;
      setErrors(flat);
      if (!Object.keys(flat).length) setFormError(e2.message);
      setBusy(false);
    }
  };

  return (
    <div className="donate-page">
      <header className="donate-page__head">
        <h1>{tr("donate.donate")}</h1>
        <p className="donate-page__lead">
          {tr("donate.support-the-ndc-or-a-candidate")}</p>
      </header>

      <form className="donate-layout" onSubmit={submit} noValidate>
        <div className="donate-form">
          {formError && <Banner tone="error" title={tr("donate.we-couldn-t-start-your-donation")}>{formError}</Banner>}

          <section className="donate-section" aria-labelledby="amount-title">
            <h2 id="amount-title">{tr("donate.1-amount")}</h2>
            <AmountPicker
              label={tr("donate.how-much-would-you-like-to")}
              presets={presets}
              value={amount}
              onChange={setAmount}
              error={errors.amount_kobo}
              hint={tr("donate.between-and-per-payment", { formatNaira: formatNaira(min), formatNaira2: formatNaira(max) })}
            />
          </section>

          <section className="donate-section" aria-labelledby="give-title">
            <h2 id="give-title">{tr("donate.2-give-to")}</h2>
            {candidateNotice && <Banner tone="info">{candidateNotice}</Banner>}
            <RadioGroup
              legend={tr("donate.who-should-receive-it")}
              name="designation"
              value={designation}
              onChange={(v) => setDesignation(v as "party" | "candidate")}
              options={[
                { value: "party", label: tr("donate.ndc-general-campaign-fund") },
                { value: "candidate", label: tr("donate.a-candidate") },
              ]}
            />
            {designation === "candidate" &&
              (candidate ? (
                <p className="donate-chosen">
                  {tr.rich("donate.giving-to-change", { full_name: candidate.full_name, strong: (chunks) => <strong>{chunks}</strong>, button: (chunks) => <Button variant="ghost" size="sm" onClick={() => setCandidate(null)}>{chunks}</Button> })}
                </p>
              ) : (
                <div className="donate-search">
                  <TextField label={tr("donate.find-a-candidate")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("donate.name-or-area")} error={errors.candidate_slug} />
                  <ul className="donate-search__results" aria-label={tr("donate.candidates")}>
                    {results.map((c) => (
                      <li key={c.slug}>
                        <button type="button" onClick={() => setCandidate({ slug: c.slug, full_name: c.full_name })}>
                          <strong>{c.full_name}</strong> <span>{c.position_label} · {c.area_display}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>

          <section className="donate-section" aria-labelledby="details-title">
            <h2 id="details-title">{tr("donate.3-your-details")}</h2>
            <p className="donate-note">{tr("donate.the-law-requires-parties-to-record")}</p>
            <TextField label={tr("donate.full-name")} required value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} error={errors.donor_name} autoComplete="name" />
            <TextField label={tr("donate.email")} type="email" required value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} error={errors.donor_email} />
            <TextField label={tr("donate.phone")} type="tel" required value={donor.phone} onChange={(e) => setDonor({ ...donor, phone: e.target.value })} error={errors.donor_phone} />
            <Select label={tr("donate.state")} required value={donor.state} onChange={(e) => setDonor({ ...donor, state: e.target.value })} error={errors.donor_state}
              options={[{ value: "", label: tr("donate.choose-your-state") }, ...STATES]} />
            <TextArea label={tr("donate.address")} required rows={2} value={donor.address} onChange={(e) => setDonor({ ...donor, address: e.target.value })} error={errors.donor_address} autoComplete="street-address" />
          </section>

          <section className="donate-section" aria-labelledby="public-title">
            <h2 id="public-title">{tr("donate.4-on-the-public-finance-page")}</h2>
            {isSignedIn ? (
              <RadioGroup
                legend={tr("donate.how-should-your-donation-appear")}
                name="display"
                value={display}
                onChange={(v) => { setDisplay(v as "name" | "anonymous"); setDisplayTouched(true); }}
                hint={tr("donate.successful-donations-are-listed-publicly-on")}
                options={[
                  { value: "name", label: tr("donate.show-my-name", { v: donor.name ? ` (“${donor.name}”)` : "" }) },
                  { value: "anonymous", label: tr("donate.show-as-anonymous-donor"), hint: tr("donate.we-still-record-your-details-privately") },
                ]}
              />
            ) : (
              <p className="donate-note">{tr("donate.you-ll-appear-as-guest")}</p>
            )}
          </section>

          <section className="donate-section" aria-labelledby="declare-title">
            <h2 id="declare-title">{tr("donate.please-confirm")}</h2>
            {DECLARATIONS.map(([key, label]) => (
              <Checkbox key={key} label={label} required checked={declared[key]} error={errors[`declarations.${key}`]}
                onChange={(e) => setDeclared({ ...declared, [key]: e.target.checked })} />
            ))}
          </section>
        </div>

        <aside className="donate-summary" aria-label={tr("donate.summary")}>
          <p className="donate-summary__amount">{amount ? formatNaira(amount) : "₦—"}</p>
          <p className="donate-summary__to">{tr("donate.to-2", { target })}</p>
          <Button type="submit" fullWidth loading={busy} loadingLabel={tr("donate.starting")}>
            {amount ? tr("donate.donate-2", { formatNaira: formatNaira(amount) }) : tr("donate.donate")}
          </Button>
          <p className="donate-summary__free">
            {tr.rich("donate.you-can-also-vote-follow-candidates", { link: (chunks) => <Link to="/candidates">{chunks}</Link> })}</p>
        </aside>
      </form>
    </div>
  );
}

