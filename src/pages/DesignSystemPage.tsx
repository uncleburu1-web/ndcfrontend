/**
 * /design-system — dev-only review page (spec §9.4).
 * Renders every token and every documented component state, and checks the contrast
 * of every text/background pair the components use, live from the computed tokens
 * (acceptance criterion 2).
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  AmountPicker,
  AttributionBadge,
  Avatar,
  Banner,
  BottomSheet,
  Button,
  CandidateCard,
  CandidateCardSkeleton,
  Checkbox,
  DonateButton,
  EmptyState,
  Modal,
  NotificationToggle,
  Pagination,
  RadioGroup,
  Select,
  SiteHeader,
  Skeleton,
  StatusBadge,
  Switch,
  Tabs,
  TextArea,
  TextField,
  Toast,
  VoteToggle,
  statusOptions,
  useToast,
} from "../components/ui";
import type { ButtonVariant } from "../components/ui/Button";
import type { StatusSet } from "../components/ui/StatusBadge";
import { contrastRatio, readToken } from "../lib/contrast";
import { formatDate, formatNaira } from "../lib/format";
import "./DesignSystemPage.css";

/* ------------------------------------------------------------------ data */

const RAW_COLOURS = [
  "--color-blue-900",
  "--color-blue-800",
  "--color-blue-200",
  "--color-blue-50",
  "--color-red-600",
  "--color-red-700",
  "--color-red-50",
  "--color-white",
  "--color-bg",
  "--color-ink",
  "--color-ink-muted",
  "--color-border",
  "--color-border-strong",
  "--color-success",
  "--color-success-50",
  "--color-warning",
  "--color-warning-50",
  "--color-error",
  "--color-error-50",
  "--color-info",
  "--color-info-50",
];

/** Every text/background (and control/background) pairing used by the components. */
const PAIRS: { fg: string; bg: string; min: number; where: string }[] = [
  { fg: "--text", bg: "--surface", min: 4.5, where: "Body text on cards" },
  { fg: "--text", bg: "--surface-page", min: 4.5, where: "Body text on page" },
  { fg: "--text-muted", bg: "--surface", min: 4.5, where: "Hints, metadata on cards" },
  { fg: "--text-muted", bg: "--surface-page", min: 4.5, where: "Hints on page, input prefix" },
  { fg: "--text-link", bg: "--surface", min: 4.5, where: "Links, ghost button (blue)" },
  { fg: "--text-link", bg: "--surface-page", min: 4.5, where: "Links on page (blue)" },
  { fg: "--text-link", bg: "--surface-brand-tint", min: 4.5, where: "Ghost hover" },
  { fg: "--text-brand", bg: "--surface-brand-tint", min: 4.5, where: "Empty-state icon, brand highlights" },
  { fg: "--text-action", bg: "--surface", min: 4.5, where: "Vote (idle) text" },
  { fg: "--text-action", bg: "--surface-accent-tint", min: 4.5, where: "Vote hover, selected amount chip" },
  { fg: "--text", bg: "--surface-accent-tint", min: 4.5, where: "Candidate attribution badge" },
  { fg: "--brand-fg", bg: "--brand-bg", min: 4.5, where: "Header text, nav links, avatars, current page" },
  { fg: "--brand-fg", bg: "--brand-bg-hover", min: 4.5, where: "Header link hover" },
  { fg: "--brand-fg-muted", bg: "--brand-bg", min: 4.5, where: "“Connect” in the header wordmark" },
  { fg: "--focus-ring-on-brand", bg: "--brand-bg", min: 3, where: "Focus ring inside the blue header (UI 3:1)" },
  { fg: "--action-border-on-brand", bg: "--brand-bg", min: 3, where: "Edge of red buttons on blue (UI 3:1)" },
  { fg: "--brand-bg", bg: "--surface", min: 3, where: "Switch on, checkbox/radio, tabs underline (UI 3:1)" },
  { fg: "--action-primary-fg", bg: "--action-primary-bg", min: 4.5, where: "Primary / Donate button" },
  { fg: "--action-primary-fg", bg: "--action-primary-bg-hover", min: 4.5, where: "Primary hover/pressed" },
  { fg: "--action-danger-fg", bg: "--action-danger-bg", min: 4.5, where: "Danger button" },
  { fg: "--tone-success-fg", bg: "--tone-success-bg", min: 4.5, where: "Success badge, Vote (following)" },
  { fg: "--tone-warning-fg", bg: "--tone-warning-bg", min: 4.5, where: "Pending badge" },
  { fg: "--tone-error-fg", bg: "--tone-error-bg", min: 4.5, where: "Error badge" },
  { fg: "--tone-neutral-fg", bg: "--tone-neutral-bg", min: 4.5, where: "Neutral badge" },
  { fg: "--tone-info-fg", bg: "--tone-info-bg", min: 4.5, where: "Official attribution badge" },
  { fg: "--text", bg: "--tone-info-bg", min: 4.5, where: "Banner text (info)" },
  { fg: "--text", bg: "--tone-warning-bg", min: 4.5, where: "Banner text (warning)" },
  { fg: "--text", bg: "--tone-error-bg", min: 4.5, where: "Banner text (error)" },
  { fg: "--text", bg: "--tone-success-bg", min: 4.5, where: "Banner text (success)" },
  { fg: "--tone-error-fg", bg: "--surface", min: 4.5, where: "Inline field errors" },
  { fg: "--border-control", bg: "--surface", min: 3, where: "Input & control outlines (UI 3:1)" },
  { fg: "--border-control", bg: "--surface-page", min: 3, where: "Pagination/chip outlines on page (UI 3:1)" },
  // The ring has a 2px offset, so it sits on the surface/page around a button, never on the red fill itself.
  { fg: "--focus-ring", bg: "--surface", min: 3, where: "Focus ring around controls on cards (UI 3:1)" },
  { fg: "--focus-ring", bg: "--surface-page", min: 3, where: "Focus ring on page (UI 3:1)" },
];

const TYPE_SCALE = ["--text-xs", "--text-sm", "--text-base", "--text-lg", "--text-xl", "--text-2xl", "--text-3xl"];
const SPACING = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8", "--space-12", "--space-16"];
const RADII = ["--radius-sm", "--radius-md", "--radius-lg", "--radius-full"];
const MOTION = ["--duration-fast", "--duration-base", "--duration-slow"];
const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const STATUS_SETS: { set: StatusSet; title: string }[] = [
  { set: "news", title: "User news (FR-024)" },
  { set: "pvc", title: "PVC (FR-010)" },
  { set: "membership", title: "Membership" },
  { set: "payment", title: "Payment" },
  { set: "volunteer", title: "Volunteer (FR-050)" },
];
const DEMO_PRESETS = [1000, 5000, 10000, 20000]; // illustrative only — real presets come from the donation spec

const SECTIONS = [
  ["colour", "Colour"],
  ["contrast", "Contrast checks"],
  ["type", "Typography"],
  ["spacing", "Spacing, radius, elevation"],
  ["motion", "Motion & breakpoints"],
  ["content", "Content conventions"],
  ["buttons", "Buttons"],
  ["vote", "Vote & notifications"],
  ["badges", "Badges"],
  ["banners", "Banners"],
  ["fields", "Form fields"],
  ["amount", "Amount picker"],
  ["candidate", "Candidate card"],
  ["overlays", "Modal, sheet, toast"],
  ["misc", "Tabs, pagination, avatar, skeleton, empty"],
] as const;

/* ------------------------------------------------------------- helpers */

function useTokenValues(names: string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(names.map((n) => [n, css.getPropertyValue(n).trim()])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return values;
}

function Section({ id, title, children, intro }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="dsp-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {intro && <p className="dsp-intro">{intro}</p>}
      {children}
    </section>
  );
}

function Demo({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`dsp-demo${wide ? " dsp-demo--wide" : ""}`}>
      <div className="dsp-demo__stage">{children}</div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

const ratio = (r: number | null) => (r === null ? "—" : `${r.toFixed(2)} : 1`);

/* ---------------------------------------------------------------- page */

export default function DesignSystemPage() {
  const toast = useToast();
  const tokenValues = useTokenValues([...RAW_COLOURS, ...TYPE_SCALE, ...SPACING, ...RADII, ...MOTION]);
  const [white, setWhite] = useState("");
  useEffect(() => setWhite(readToken("--color-white")), []);

  const [pairs, setPairs] = useState<{ fg: string; bg: string; min: number; where: string; r: number | null }[]>([]);
  useEffect(() => {
    setPairs(PAIRS.map((p) => ({ ...p, r: contrastRatio(readToken(p.fg), readToken(p.bg)) })));
  }, []);
  const failing = pairs.filter((p) => p.r === null || p.r < p.min);

  const [viewport, setViewport] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const bp = viewport >= 1280 ? "lg (≥1280)" : viewport >= 1024 ? "md (≥1024)" : viewport >= 640 ? "sm (≥640)" : "base (<640)";

  // Interactive demo state
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(false);
  const [failFollowing, setFailFollowing] = useState(false);
  const [switchOn, setSwitchOn] = useState(false);
  const [radio, setRadio] = useState("display");
  const [amount, setAmount] = useState<number | null>(null);
  const [amountPreset] = useState<number | null>(5000);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState("announcements");
  const [page, setPage] = useState(4);
  const [bannerKey, setBannerKey] = useState(0);
  const [motionDemo, setMotionDemo] = useState(false);

  useEffect(() => {
    if (!following) setNotify(false);
  }, [following]);

  const fakeRequest = (succeed: boolean) => () => new Promise<void>((res, rej) => setTimeout(() => (succeed ? res() : rej(new Error("network"))), 900));

  return (
    <>
      <SiteHeader
        links={[
          { label: "Candidates", href: "#candidate" },
          { label: "News", href: "#badges" },
          { label: "Design system", href: "/design-system", current: true },
        ]}
        donateHref="#buttons"
        joinHref="#buttons"
      />

      <div className="dsp">
        <aside className="dsp-toc" aria-label="Sections">
          <ol>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </aside>

        <main className="dsp-main">
          <header className="dsp-hero">
            <h1>NDCConnect design system</h1>
            <p>
              Dev-only review page for <code>feature-specs/01-design-system.md</code>. Every token and documented component
              state is rendered below.
            </p>
            <Banner tone="info" title="Brand colours from the official NDC logo">
              Blue = brand and navigation · red = actions · white = surfaces. Type and spacing values are still proposals
              pending owner approval (spec §11).
            </Banner>
          </header>

          {/* ------------------------------------------------ Colour */}
          <Section id="colour" title="Colour" intro="Raw scale from tokens.css. Components only use the semantic aliases built on these.">
            <ul className="dsp-swatches">
              {RAW_COLOURS.map((name) => {
                const value = tokenValues[name] ?? "";
                return (
                  <li key={name} className="dsp-swatch">
                    <span className="dsp-swatch__chip" style={{ background: `var(${name})` }} />
                    <code>{name}</code>
                    <span className="dsp-swatch__value">{value}</span>
                    <span className="dsp-swatch__ratio">
                      on white {ratio(white ? contrastRatio(value, white) : null)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* ------------------------------------------------ Contrast */}
          <Section
            id="contrast"
            title="Contrast checks"
            intro="Every text/background pair the components use, computed live from the tokens. Text needs 4.5:1; UI control boundaries need 3:1."
          >
            <p className={`dsp-verdict ${failing.length ? "dsp-verdict--fail" : "dsp-verdict--pass"}`} data-testid="contrast-verdict">
              {pairs.length === 0 ? "Checking…" : failing.length ? `${failing.length} pair(s) fail WCAG AA` : `All ${pairs.length} pairs meet WCAG AA`}
            </p>
            <div className="dsp-table-wrap">
              <table className="dsp-table">
                <thead>
                  <tr>
                    <th scope="col">Sample</th>
                    <th scope="col">Foreground / background</th>
                    <th scope="col">Used for</th>
                    <th scope="col">Ratio</th>
                    <th scope="col">Needs</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => {
                    const pass = p.r !== null && p.r >= p.min;
                    return (
                      <tr key={p.fg + p.bg} data-pass={pass}>
                        <td>
                          <span className="dsp-sample" style={{ color: `var(${p.fg})`, background: `var(${p.bg})`, borderColor: `var(${p.fg})` }}>
                            Aa
                          </span>
                        </td>
                        <td>
                          <code>{p.fg}</code> / <code>{p.bg}</code>
                        </td>
                        <td>{p.where}</td>
                        <td>{ratio(p.r)}</td>
                        <td>{p.min}:1</td>
                        <td>{pass ? <StatusBadge set="payment" status="successful" /> : <StatusBadge set="payment" status="failed" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------ Typography */}
          <Section id="type" title="Typography" intro="Archivo Variable, self-hosted Latin subset. Headings use the expanded width; body uses normal width.">
            <div className="dsp-type">
              {[...TYPE_SCALE].reverse().map((name) => (
                <div key={name} className="dsp-type__row">
                  <code>
                    {name} · {tokenValues[name]}
                  </code>
                  <span
                    style={{
                      fontSize: `var(${name})`,
                      fontWeight: ["--text-xl", "--text-2xl", "--text-3xl"].includes(name) ? "var(--weight-heading)" : undefined,
                      fontStretch: ["--text-xl", "--text-2xl", "--text-3xl"].includes(name) ? "var(--stretch-heading)" : undefined,
                    }}
                  >
                    Follow candidates, donate ₦5,000
                  </span>
                </div>
              ))}
            </div>
            <div className="dsp-row">
              <Demo label="Weights: 400 body · 600 label · 780 heading">
                <p style={{ margin: 0 }}>
                  <span style={{ fontWeight: "var(--weight-body)" }}>Body 400</span> ·{" "}
                  <span style={{ fontWeight: "var(--weight-label)" }}>Label 600</span> ·{" "}
                  <span style={{ fontWeight: "var(--weight-heading)", fontStretch: "var(--stretch-heading)" }}>Heading 780</span>
                </p>
              </Demo>
              <Demo label="Body paragraph — line-height 1.5, max ~70ch">
                <p style={{ margin: 0 }}>
                  Candidates you follow can post announcements directly to their page. You’ll only get a notification when you
                  turn it on for that candidate.
                </p>
              </Demo>
            </div>
          </Section>

          {/* ------------------------------------------------ Spacing etc. */}
          <Section id="spacing" title="Spacing, radius, elevation">
            <div className="dsp-row">
              <Demo label="Spacing — 4px base">
                <ul className="dsp-spacing">
                  {SPACING.map((s) => (
                    <li key={s}>
                      <code>
                        {s} · {tokenValues[s]}
                      </code>
                      <span style={{ width: `var(${s})` }} />
                    </li>
                  ))}
                </ul>
              </Demo>
              <Demo label="Radius — by hierarchy">
                <div className="dsp-radii">
                  {RADII.map((r) => (
                    <div key={r} style={{ borderRadius: `var(${r})` }}>
                      <code>{r.replace("--radius-", "")}</code>
                    </div>
                  ))}
                </div>
              </Demo>
              <Demo label="Elevation — flat + border by default; shadow only for overlays">
                <div className="dsp-elev">
                  <div className="dsp-elev__flat">Flat card (border)</div>
                  <div className="dsp-elev__overlay">--shadow-overlay</div>
                </div>
              </Demo>
            </div>
          </Section>

          {/* ------------------------------------------------ Motion */}
          <Section id="motion" title="Motion & breakpoints" intro="Motion only answers user actions. With reduced motion on, durations drop to zero.">
            <div className="dsp-row">
              <Demo label="Durations">
                <ul className="dsp-list">
                  {MOTION.map((m) => (
                    <li key={m}>
                      <code>
                        {m} · {tokenValues[m]}
                      </code>
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" size="sm" onClick={() => setMotionDemo((v) => !v)} aria-pressed={motionDemo}>
                  Toggle slide demo
                </Button>
                <div className="dsp-motion-track">
                  <span className={`dsp-motion-dot${motionDemo ? " is-on" : ""}`} />
                </div>
              </Demo>
              <Demo label="Breakpoints — mobile first, base targets 360px">
                <ul className="dsp-list">
                  <li>
                    <code>base</code> 360px+
                  </li>
                  <li>
                    <code>--bp-sm</code> 640px
                  </li>
                  <li>
                    <code>--bp-md</code> 1024px
                  </li>
                  <li>
                    <code>--bp-lg</code> 1280px
                  </li>
                </ul>
                <p className="dsp-note" data-testid="viewport">
                  Viewport {viewport}px → {bp}
                </p>
              </Demo>
            </div>
          </Section>

          {/* ------------------------------------------------ Content */}
          <Section id="content" title="Content conventions">
            <div className="dsp-table-wrap">
              <table className="dsp-table">
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Naira, no decimals unless non-zero</td>
                    <td data-testid="naira">
                      {formatNaira(20000)} · {formatNaira(1500.5)} · {formatNaira(250000)}
                    </td>
                  </tr>
                  <tr>
                    <td>Date</td>
                    <td data-testid="date">{formatDate("2026-10-31T13:45:00Z")}</td>
                  </tr>
                  <tr>
                    <td>Date + time (WAT where ambiguous)</td>
                    <td data-testid="datetime">{formatDate("2026-10-31T13:45:00Z", { withTime: true, showZone: true })}</td>
                  </tr>
                  <tr>
                    <td>Buttons say what happens</td>
                    <td>
                      “Donate ₦5,000”, “Pay ₦20,000 membership fee”, “Submit for review”. Not “Submit” or “OK”.
                    </td>
                  </tr>
                  <tr>
                    <td>Errors: what went wrong + how to fix</td>
                    <td>“Enter an amount of at least ₦100.” Not “Invalid input.”</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ------------------------------------------------ Buttons */}
          <Section id="buttons" title="Buttons" intro="§6.1 variants × states, §6.2 Donate. md is 44px (touch target); sm is 36px for dense desktop tables only.">
            <div className="dsp-table-wrap">
              <table className="dsp-table dsp-table--states">
                <thead>
                  <tr>
                    <th scope="col">Variant</th>
                    {["Default", "Hover", "Pressed", "Focus-visible", "Disabled", "Loading", "Small"].map((s) => (
                      <th scope="col" key={s}>
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BUTTON_VARIANTS.map((v) => (
                    <tr key={v}>
                      <th scope="row">{v}</th>
                      <td>
                        <Button variant={v}>Save changes</Button>
                      </td>
                      <td>
                        <Button variant={v} data-force="hover">
                          Save changes
                        </Button>
                      </td>
                      <td>
                        <Button variant={v} data-force="pressed">
                          Save changes
                        </Button>
                      </td>
                      <td>
                        <Button variant={v} data-force="focus">
                          Save changes
                        </Button>
                      </td>
                      <td>
                        <Button variant={v} disabled>
                          Save changes
                        </Button>
                      </td>
                      <td>
                        <Button variant={v} loading loadingLabel="Saving…">
                          Save changes
                        </Button>
                      </td>
                      <td>
                        <Button variant={v} size="sm">
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dsp-row">
              <Demo label="Donate — fixed label, primary. Also in the header (desktop) and bottom bar (mobile).">
                <DonateButton onClick={() => toast.show({ tone: "info", message: "Donate opens the donation flow (built in the donation spec)." })} />
              </Demo>
              <Demo label="Loading with a verb">
                <Button loading loadingLabel="Paying…">
                  Pay ₦20,000 membership fee
                </Button>
              </Demo>
            </div>
          </Section>

          {/* ------------------------------------------------ Vote */}
          <Section id="vote" title="Vote (Follow) & notifications" intro="§6.3 and §6.4. Vote never sits next to Donate in a way that implies donating is required.">
            <div className="dsp-row">
              <Demo label="Not following">
                <VoteToggle candidateName="Amina Bello" following={false} />
              </Demo>
              <Demo label="Following">
                <VoteToggle candidateName="Amina Bello" following />
              </Demo>
              <Demo label="Following — confirmation hint before unfollow">
                <VoteToggle candidateName="Amina Bello" following confirming />
              </Demo>
              <Demo label="Loading">
                <VoteToggle candidateName="Amina Bello" following={false} loading />
              </Demo>
            </div>
            <div className="dsp-row">
              <Demo label="Interactive — succeeds. Tap Vote, then the bell switch appears (off by default).">
                <div className="dsp-stack">
                  <VoteToggle
                    candidateName="Amina Bello"
                    following={following}
                    onChange={async (next) => {
                      await fakeRequest(true)();
                      setFollowing(next);
                    }}
                  />
                  <NotificationToggle candidateName="Amina Bello" following={following} enabled={notify} onChange={setNotify} />
                </div>
              </Demo>
              <Demo label="Error — request fails, toggle reverts, toast explains">
                <VoteToggle
                  candidateName="Chidi Okafor"
                  following={failFollowing}
                  onChange={async (next) => {
                    await fakeRequest(false)();
                    setFailFollowing(next);
                  }}
                />
              </Demo>
              <Demo label="Notification toggle — off (default) and on, shown only while following">
                <div className="dsp-stack">
                  <NotificationToggle candidateName="Amina Bello" following enabled={false} onChange={() => {}} />
                  <NotificationToggle candidateName="Amina Bello" following enabled onChange={() => {}} />
                  <p className="dsp-note">Not following → the toggle renders nothing.</p>
                </div>
              </Demo>
            </div>
          </Section>

          {/* ------------------------------------------------ Badges */}
          <Section id="badges" title="Badges" intro="§6.5 status badges (icon + text + colour) and §6.6 source attribution.">
            <div className="dsp-table-wrap">
              <table className="dsp-table">
                <thead>
                  <tr>
                    <th scope="col">Status set</th>
                    <th scope="col">States</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_SETS.map(({ set, title }) => (
                    <tr key={set}>
                      <th scope="row">{title}</th>
                      <td>
                        <div className="dsp-badges">
                          {statusOptions(set).map((s) => (
                            <StatusBadge key={String(s)} set={set} status={s as never} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dsp-row">
              <Demo label="Official NDCConnect announcement">
                <AttributionBadge source="official" />
              </Demo>
              <Demo label="Candidate post (verified)">
                <AttributionBadge source="candidate" candidateName="Amina Bello" verified />
              </Demo>
              <Demo label="Candidate post (not verified)">
                <AttributionBadge source="candidate" candidateName="Chidi Okafor" />
              </Demo>
              <Demo label="User-submitted news (approved)">
                <AttributionBadge source="user" />
              </Demo>
            </div>
          </Section>

          {/* ------------------------------------------------ Banners */}
          <Section id="banners" title="Banners" intro="§6.7. Never a modal on candidate or donation pages.">
            <div className="dsp-stack dsp-stack--lg">
              <Banner tone="info">Candidate posts publish straight away; member news is reviewed first.</Banner>
              <Banner tone="success" title="Payment confirmed">
                Your ₦20,000 membership fee was received. Approval usually takes 2–3 days.
              </Banner>
              <Banner tone="warning" dismissible>
                Your PVC verification is pending. We’ll let you know when it’s reviewed.
              </Banner>
              <Banner tone="error" title="Payment failed">
                Your bank declined the payment. Try another card or bank transfer.
              </Banner>
              <div key={bannerKey}>
                <Banner
                  tone="info"
                  title="Verify your PVC to join community discussions"
                  dismissKey="pvc-invite-demo"
                  action={
                    <Button variant="secondary" size="sm" href="#banners">
                      Verify your PVC
                    </Button>
                  }
                >
                  You can still follow candidates and donate without it.
                </Banner>
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    try {
                      window.localStorage.removeItem("ndc:banner-dismissed:pvc-invite-demo");
                    } catch {
                      /* ignore */
                    }
                    setBannerKey((k) => k + 1);
                  }}
                >
                  Reset the PVC invitation demo
                </Button>
                <p className="dsp-note">The PVC invitation stays hidden after dismissal (remembered per browser).</p>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ Fields */}
          <Section id="fields" title="Form fields" intro="§6.8. Visible label, optional hint, inline error tied with aria-describedby, required written in text.">
            <div className="dsp-grid">
              <TextField label="Full name" required placeholder="Amina Bello" />
              <TextField label="Display name" hint="Shown on the public Finance page unless you donate anonymously." />
              <TextField label="Email" type="email" required error="Enter a valid email address, like name@example.com." defaultValue="amina@" />
              <TextField label="Phone number" type="tel" />
              <TextField label="VIN" disabled defaultValue="Locked during review" hint="Disabled state." />
              <Select
                label="Elective position"
                placeholder="Choose a position"
                defaultValue=""
                options={[
                  { value: "president", label: "President" },
                  { value: "governor", label: "Governor" },
                  { value: "senate", label: "Senate" },
                ]}
              />
              <Select label="State" error="Choose your state." defaultValue="" placeholder="Choose a state" options={[{ value: "lagos", label: "Lagos" }, { value: "kano", label: "Kano" }]} />
              <TextArea label="News content" required hint="Add the source link so reviewers can check it." />
            </div>
            <div className="dsp-grid">
              <div>
                <Checkbox label="Donate anonymously" hint="Your name is shown as “Anonymous Donor” on the Finance page." />
                <Checkbox label="I agree to the membership terms" required error="Agree to the terms to continue." />
                <Checkbox label="Disabled option" disabled />
              </div>
              <RadioGroup
                legend="Public donor label"
                name="label-demo"
                value={radio}
                onChange={setRadio}
                options={[
                  { value: "display", label: "Show my display name" },
                  { value: "anonymous", label: "Anonymous Donor", hint: "Admins can still see your name for compliance." },
                ]}
              />
              <div>
                <Switch label="Email me about events I register for" checked={switchOn} onChange={setSwitchOn} hint="Switch, interactive." />
                <Switch label="Disabled switch" checked={false} onChange={() => {}} disabled />
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------ Amount */}
          <Section id="amount" title="Amount picker" intro="§6.9. Preset values here are illustrative; the donation spec sets the real ones. Limits come from the backend.">
            <div className="dsp-grid">
              <AmountPicker presets={DEMO_PRESETS} value={amount} onChange={setAmount} hint="Choose an amount or enter your own." />
              <AmountPicker label="Preset selected" presets={DEMO_PRESETS} value={amountPreset} onChange={() => {}} />
              <AmountPicker
                label="Backend compliance error"
                presets={DEMO_PRESETS}
                value={50}
                onChange={() => {}}
                error="Enter an amount of at least ₦100."
              />
            </div>
            <p className="dsp-note" data-testid="amount-value">
              Interactive value: {amount === null ? "none" : formatNaira(amount)}
            </p>
          </Section>

          {/* ------------------------------------------------ Candidate card */}
          <Section id="candidate" title="Candidate card" intro="§6.10. Photo (initials fallback), name, position, area, party, verified tick, optional Vote and Donate.">
            <div className="dsp-cards">
              <CandidateCard
                name="Amina Bello"
                position="Governor"
                area="Kano State"
                party="NDC"
                verified
                href="#candidate"
                actions={
                  <>
                    <VoteToggle candidateName="Amina Bello" following={false} />
                    <DonateButton href="#candidate" />
                  </>
                }
              />
              <CandidateCard name="Chidi Okafor" position="Senate" area="Anambra Central" party="NDC" href="#candidate" />
              <CandidateCardSkeleton />
            </div>
          </Section>

          {/* ------------------------------------------------ Overlays */}
          <Section id="overlays" title="Modal, bottom sheet, toast" intro="Focus-trapped, Esc closes, focus returns to the opener.">
            <div className="dsp-row">
              <Demo label="Modal dialog">
                <Button variant="secondary" onClick={() => setModalOpen(true)}>
                  Open modal
                </Button>
              </Demo>
              <Demo label="Bottom sheet (mobile) — centred dialog from 640px">
                <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                  Open bottom sheet
                </Button>
              </Demo>
              <Demo label="Trigger a toast">
                <Button variant="secondary" onClick={() => toast.show({ tone: "success", message: "You’re now following Amina Bello." })}>
                  Show toast
                </Button>
              </Demo>
            </div>
            <div className="dsp-stack dsp-toast-preview">
              <Toast tone="info" message="Candidate posts appear on their profile." />
              <Toast tone="success" message="You’re now following Amina Bello." onDismiss={() => {}} />
              <Toast tone="warning" message="Your session expires in 2 minutes." />
              <Toast tone="error" message="We couldn't follow Chidi Okafor. Check your connection and tap Vote again." onDismiss={() => {}} />
            </div>

            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Unpublish this candidate?"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>
                    Keep published
                  </Button>
                  <Button variant="danger" onClick={() => setModalOpen(false)}>
                    Unpublish candidate
                  </Button>
                </>
              }
            >
              <p>Amina Bello will disappear from the public Candidates page. Followers keep their follow, and you can publish again later.</p>
            </Modal>

            <BottomSheet
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              title="Notification settings"
              footer={
                <Button fullWidth onClick={() => setSheetOpen(false)}>
                  Save settings
                </Button>
              }
            >
              <Switch label="Notify me when Amina Bello posts" checked={notify} onChange={setNotify} />
            </BottomSheet>
          </Section>

          {/* ------------------------------------------------ Misc */}
          <Section id="misc" title="Tabs, pagination, avatar, skeleton, empty state">
            <Demo label="Tabs — arrow keys, Home/End" wide>
              <Tabs
                label="Candidate profile"
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "announcements", label: "Announcements", content: <p>Posts by the candidate appear here.</p> },
                  { id: "about", label: "About", content: <p>Biography and campaign priorities.</p> },
                  { id: "events", label: "Events", content: <p>Upcoming campaign events.</p> },
                ]}
              />
            </Demo>
            <Demo label="Pagination — numbered from 640px; “Page X of Y” on mobile" wide>
              <Pagination page={page} pageCount={12} onChange={setPage} />
            </Demo>
            <div className="dsp-row">
              <Demo label="Avatar — sizes, initials fallback, broken image falls back too">
                <div className="dsp-inline">
                  <Avatar name="Amina Bello" size="xs" />
                  <Avatar name="Amina Bello" size="sm" />
                  <Avatar name="Amina Bello" size="md" />
                  <Avatar name="Chidi Okafor" size="lg" src="/missing-photo.jpg" />
                </div>
              </Demo>
              <Demo label="Skeleton loader">
                <div className="dsp-stack" aria-busy="true">
                  <span className="visually-hidden">Loading…</span>
                  <Skeleton width="60%" height={20} />
                  <Skeleton width="90%" />
                  <Skeleton width="75%" />
                </div>
              </Demo>
            </div>
            <Demo label="Empty state — says what to do next" wide>
              <EmptyState title="You’re not following anyone yet" action={<Button href="#candidate">Browse candidates</Button>}>
                Tap Vote on a candidate’s profile to follow them and see their announcements.
              </EmptyState>
            </Demo>
          </Section>
        </main>
      </div>
    </>
  );
}
