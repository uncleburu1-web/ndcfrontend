/** /security — how to report a vulnerability (spec 14 §4.12). Wording pending the legal team's sign-off (§15.9). */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Banner } from "../../components/ui";
import "../../privacy/privacy.css";

const CONTACT = (import.meta.env.VITE_SECURITY_CONTACT as string | undefined) ?? "";

export default function SecurityPage() {
  useEffect(() => {
    document.title = "Security | NDCConnect";
  }, []);
  return (
    <div className="privacy-page">
      <h1>Report a security problem</h1>
      <p className="privacy-lead">If you’ve found a weakness in NDCConnect, tell us privately so we can fix it before anyone misuses it.</p>
      <Banner tone="info" title="Draft — under legal review">The safe-harbour wording below may change once the party’s legal team has reviewed it.</Banner>

      <h2>How to report</h2>
      <p>
        {CONTACT ? (
          <>Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</>
        ) : (
          <>Email the security contact listed in <a href="/.well-known/security.txt">security.txt</a>.</>
        )}{" "}
        We acknowledge every report within 3 working days and keep you updated until it’s fixed.
      </p>

      <h2>What to include</h2>
      <ul className="privacy-list">
        <li>The page or API address, and what you did, step by step.</li>
        <li>What you could see or change that you shouldn’t have.</li>
        <li>Screenshots or a short video if they help. Please don’t include other people’s personal data.</li>
      </ul>

      <h2>In scope</h2>
      <ul className="privacy-list">
        <li>The NDCConnect web app and its API.</li>
        <li>Ways to see another person’s data, act as another person or an admin, or change records you shouldn’t.</li>
      </ul>

      <h2>Out of scope</h2>
      <ul className="privacy-list">
        <li>Denial-of-service, spam or social engineering of staff or members.</li>
        <li>Clerk’s and Paystack’s own services (report those to them).</li>
        <li>Missing best-practice headers with no demonstrated impact.</li>
      </ul>

      <h2>Our promise</h2>
      <p>
        If you act in good faith, follow these rules, stop as soon as you find a problem, don’t keep or share any personal data, and give us
        reasonable time to fix it, we won’t pursue or support legal action against you for your research.
      </p>
      <p className="privacy-meta"><Link to="/privacy">How we handle your data</Link></p>
    </div>
  );
}
