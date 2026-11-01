/**
 * /donate — spec 05 §4.1. Guests welcome; signed-in donors get their details prefilled.
 * The money moves on the provider's hosted checkout, never here (§3.8).
 */
import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import type { CandidateProfile, CandidateSummary, Paginated } from "../../candidates/types";
import { AmountPicker, Banner, Button, Checkbox, EmptyState, RadioGroup, Select, Skeleton, TextArea, TextField } from "../../components/ui";
import { useDonationConfig } from "../../donations/DonationConfigProvider";
import { nairaToKobo } from "../../donations/money";
import { redirectTo } from "../../donations/navigation";
import { formatNaira } from "../../lib/format";
import { STATES } from "../../lib/nigeria";
import "./donate.css";

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
  const [declared, setDeclared] = useState({ own_funds: false, nigerian_source: false, voluntary: false });
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Donate | NDCConnect";
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

  // ?candidate=<slug> preselects; unknown/unpublished falls back to the NDC fund with a notice.
  useEffect(() => {
    if (!presetSlug) return;
    api<CandidateProfile>(`/candidates/${encodeURIComponent(presetSlug)}/`, { anonymous: true })
      .then((c) => setCandidate({ slug: c.slug, full_name: c.full_name }))
      .catch(() => {
        setDesignation("party");
        setCandidateNotice("That candidate isn’t available for donations, so your gift is set to the NDC general fund. You can choose another candidate.");
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
        <span className="visually-hidden">Loading</span>
        <Skeleton width="40%" height={36} />
        <Skeleton width="80%" />
      </div>
    );
  }
  if (!config.open) {
    return (
      <div className="page-shell">
        <EmptyState title="Donations aren’t open yet" action={<Button href="/candidates">See candidates</Button>}>
          You can still vote (follow) candidates for free.
        </EmptyState>
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
        <h1>Donate</h1>
        <p className="donate-page__lead">
          Support the NDC or a candidate’s campaign. Payment happens on our payment provider’s secure page; NDCConnect never sees your card.
        </p>
      </header>

      <form className="donate-layout" onSubmit={submit} noValidate>
        <div className="donate-form">
          {formError && <Banner tone="error" title="We couldn’t start your donation">{formError}</Banner>}

          <section className="donate-section" aria-labelledby="amount-title">
            <h2 id="amount-title">1. Amount</h2>
            <AmountPicker
              label="How much would you like to give?"
              presets={presets}
              value={amount}
              onChange={setAmount}
              error={errors.amount_kobo}
              hint={`Between ${formatNaira(min)} and ${formatNaira(max)} per payment.`}
            />
          </section>

          <section className="donate-section" aria-labelledby="give-title">
            <h2 id="give-title">2. Give to</h2>
            {candidateNotice && <Banner tone="info">{candidateNotice}</Banner>}
            <RadioGroup
              legend="Who should receive it?"
              name="designation"
              value={designation}
              onChange={(v) => setDesignation(v as "party" | "candidate")}
              options={[
                { value: "party", label: "NDC (general campaign fund)" },
                { value: "candidate", label: "A candidate" },
              ]}
            />
            {designation === "candidate" &&
              (candidate ? (
                <p className="donate-chosen">
                  Giving to <strong>{candidate.full_name}</strong>{" "}
                  <Button variant="ghost" size="sm" onClick={() => setCandidate(null)}>
                    Change
                  </Button>
                </p>
              ) : (
                <div className="donate-search">
                  <TextField label="Find a candidate" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or area" error={errors.candidate_slug} />
                  <ul className="donate-search__results" aria-label="Candidates">
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
            <h2 id="details-title">3. Your details</h2>
            <p className="donate-note">The law requires parties to record who donates (name and address). We never show these publicly.</p>
            <TextField label="Full name" required value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} error={errors.donor_name} autoComplete="name" />
            <TextField label="Email" type="email" required value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} error={errors.donor_email} />
            <TextField label="Phone" type="tel" required value={donor.phone} onChange={(e) => setDonor({ ...donor, phone: e.target.value })} error={errors.donor_phone} />
            <Select label="State" required value={donor.state} onChange={(e) => setDonor({ ...donor, state: e.target.value })} error={errors.donor_state}
              options={[{ value: "", label: "Choose your state" }, ...STATES]} />
            <TextArea label="Address" required rows={2} value={donor.address} onChange={(e) => setDonor({ ...donor, address: e.target.value })} error={errors.donor_address} autoComplete="street-address" />
          </section>

          <section className="donate-section" aria-labelledby="public-title">
            <h2 id="public-title">4. On the public Finance page</h2>
            {isSignedIn ? (
              <RadioGroup
                legend="How should your donation appear?"
                name="display"
                value={display}
                onChange={(v) => setDisplay(v as "name" | "anonymous")}
                hint="Successful donations are listed publicly on the Finance page with the amount and who it went to."
                options={[
                  { value: "name", label: `Show my name${donor.name ? ` (“${donor.name}”)` : ""}` },
                  { value: "anonymous", label: "Show as “Anonymous Donor”", hint: "We still record your details privately, as the law requires." },
                ]}
              />
            ) : (
              <p className="donate-note">You’ll appear as “Guest”.</p>
            )}
          </section>

          <section className="donate-section" aria-labelledby="declare-title">
            <h2 id="declare-title">Please confirm</h2>
            {DECLARATIONS.map(([key, label]) => (
              <Checkbox key={key} label={label} required checked={declared[key]} error={errors[`declarations.${key}`]}
                onChange={(e) => setDeclared({ ...declared, [key]: e.target.checked })} />
            ))}
          </section>
        </div>

        <aside className="donate-summary" aria-label="Summary">
          <p className="donate-summary__amount">{amount ? formatNaira(amount) : "₦—"}</p>
          <p className="donate-summary__to">to {target}</p>
          <Button type="submit" fullWidth loading={busy} loadingLabel="Starting…">
            {amount ? `Donate ${formatNaira(amount)}` : "Donate"}
          </Button>
          <p className="donate-summary__free">
            You can also <Link to="/candidates">vote (follow) candidates</Link> for free. Donating is optional.
          </p>
        </aside>
      </form>
    </div>
  );
}

