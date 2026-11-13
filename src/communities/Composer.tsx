/**
 * Write a post or comment (spec 17 §7). Counter, the rules reminder, and the campaign picker for linked accounts (rule 7).
 * Consent is asked by the API client when the server answers `consent_required` (14); other refusals show in words.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Banner, Button, Select, TextArea } from "../components/ui";
import { formatDate } from "../lib/format";
import { getLanguage, t } from "../i18n";
import { defaultWritingLanguage, WrittenIn } from "../i18n/ContentLanguage";

interface Props<T> {
  path: string;
  kind: "post" | "comment";
  campaigns?: { id: string; name: string }[];
  onPosted: (item: T) => void;
}

const LIMIT = { post: 2000, comment: 1000 };
const MIN = { post: 10, comment: 2 };

export function refusalWords(err: unknown): string {
  if (!(err instanceof ApiError)) return "That didn’t post. Check your connection and try again.";
  const until = (err.extra as { until?: string } | undefined)?.until;
  if (until && (err.code === "too_soon" || err.code === "posting_paused" || err.code === "publishing_paused")) {
    return `${err.message.replace(/\.$/, "")} (until ${formatDate(until, { withTime: true })}).`;
  }
  return err.fields?.body?.[0] ?? err.message;
}

export function Composer<T>({ path, kind, campaigns = [], onPosted }: Props<T>) {
  const api = useApi();
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState<string>(defaultWritingLanguage(getLanguage()));
  const [campaign, setCampaign] = useState(campaigns.length === 1 ? campaigns[0].id : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const over = body.length > LIMIT[kind];
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const item = await api<T>(path, { method: "POST", body: { body, language, ...(campaign ? { campaign_candidate: campaign } : {}) } });
      setBody("");
      onPosted(item);
    } catch (err) {
      setError(refusalWords(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="comm-composer" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {kind === "post" && <p className="ds-field__hint">{t.rich("communities.keep-to-the-rules-only-inec", { link: (chunks) => <Link to="/rules">{chunks}</Link> })}</p>}
      <TextArea label={kind === "post" ? t("communities.write-a-post") : t("communities.write-a-comment")} rows={kind === "post" ? 4 : 2} value={body}
        onChange={(e) => setBody(e.target.value)} />
      {kind === "post" && <WrittenIn value={language} onChange={setLanguage} />}
      {campaigns.length > 0 && (
        <Select label={t("communities.posting-for")} required value={campaign} onChange={(e) => setCampaign(e.target.value)}
          placeholder={t("communities.choose-the-campaign")} options={campaigns.map((c) => ({ value: c.id, label: t("communities.campaign-team", { name: c.name }) }))}
          hint={t("communities.campaign-accounts-always-post-with-a")} />
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <div className="comm-composer__row">
        <span className={`comm-count${over ? " comm-count--over" : ""}`} aria-live="polite">{body.length.toLocaleString()} / {LIMIT[kind].toLocaleString()}</span>
        <Button type="submit" loading={busy} disabled={body.trim().length < MIN[kind] || over || (campaigns.length > 1 && !campaign)}>
          {kind === "post" ? t("communities.post") : t("communities.comment")}
        </Button>
      </div>
    </form>
  );
}
