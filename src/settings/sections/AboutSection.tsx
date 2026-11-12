/** /settings/about (spec 20 §15): versions, policies and contact. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { formatDate } from "../../lib/format";
import { SectionShell } from "../SettingsLayout";

const CONTACT = (import.meta.env.VITE_SECURITY_CONTACT as string | undefined) ?? "";

export default function AboutSection() {
  const api = useApi();
  const [health, setHealth] = useState<{ api_version?: string; commit?: string } | null>(null);
  useEffect(() => {
    api<{ api_version?: string; commit?: string }>("/health/", { anonymous: true }).then(setHealth).catch(() => setHealth({}));
  }, [api]);
  // typeof keeps this safe in builds without the define (tests, the live-check stub)
  const commit = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";
  const built = typeof __APP_BUILT_AT__ === "string" && __APP_BUILT_AT__ ? formatDate(__APP_BUILT_AT__) : "";
  return (
    <SectionShell guestOk title="About">
      <div className="set-card">
        <dl className="set-facts">
          <div><dt>App version</dt><dd>{commit || "development build"}{built ? ` · built ${built}` : ""}</dd></div>
          <div>
            <dt>API version</dt>
            <dd>{health === null ? "Checking…" : health.api_version ? `${health.api_version}${health.commit ? ` · ${health.commit}` : ""}` : "Unavailable right now"}</dd>
          </div>
        </dl>
      </div>
      <div className="set-card">
        <h3>Policies and help</h3>
        <ul className="set-links">
          <li><Link to="/privacy">Privacy notice</Link></li>
          <li><Link to="/rules">Community rules</Link></li>
          <li><Link to="/security">Report a security problem</Link></li>
          <li><Link to="/finance">Finance: donations and spending</Link></li>
          <li><Link to="/pvc">How to get your PVC</Link></li>
          <li>Contact: {CONTACT ? <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : <a href="/.well-known/security.txt">see security.txt</a>}</li>
        </ul>
      </div>
      <div className="set-card">
        <p>NDCConnect is the political engagement platform of the Nigeria Democratic Congress (NDC).</p>
        <p className="set-meta">NDCConnect isn’t INEC. Only INEC registers voters, issues PVCs and announces election results.</p>
      </div>
    </SectionShell>
  );
}
