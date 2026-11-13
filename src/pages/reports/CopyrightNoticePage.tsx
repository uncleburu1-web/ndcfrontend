/** /report/copyright — a copyright notice with the Copyright Act 2022 s. 54(2) details, in plain English (spec 13 §4.7). */
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useAuth } from "@clerk/react";
import { Banner, Button, Checkbox, TextArea, TextField } from "../../components/ui";
import "../../moderation/moderation.css";
import { t as tr } from "../../i18n";

const EMPTY = { name: "", contact: "", work: "", url: "", signature: "" };

export default function CopyrightNoticePage() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [ticks, setTicks] = useState({ authority: false, good_faith: false, accurate: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  useEffect(() => {
    document.title = tr("reports.copyright-notice-ndcconnect");
  }, []);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const out = await api<{ reference: string }>("/report/copyright/", { method: "POST", body: { ...f, ...ticks }, anonymous: !isSignedIn });
      setReference(out.reference);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.message);
      } else setError(tr("reports.we-couldn-t-send-your-notice"));
    } finally {
      setBusy(false);
    }
  };
  const fe = (k: string) => errors[k]?.[0];

  if (reference) {
    return (
      <div className="mod-page">
        <h1>{tr("reports.copyright-notice-received")}</h1>
        <p className="mod-ref"><strong>{reference}</strong></p>
        <p>{tr.rich("reports.we-ll-review-it-and-may", { link: (chunks) => <Link to="/reports/status">{chunks}</Link> })}</p>
      </div>
    );
  }
  return (
    <div className="mod-page">
      <h1>{tr("reports.send-a-copyright-notice")}</h1>
      <p className="mod-lead">
        {tr("reports.use-this-if-something-on-ndcconnect")}</p>
      {error && <Banner tone="error">{error}</Banner>}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <TextField label={tr("reports.your-name")} required value={f.name} onChange={set("name")} error={fe("name")} autoComplete="name" />
        <TextField label={tr("reports.how-we-can-contact-you")} required value={f.contact} onChange={set("contact")} error={fe("contact")}
          hint={tr("reports.an-email-address-or-phone-number")} />
        <TextArea label={tr("reports.the-work-that-was-copied")} required rows={3} value={f.work} onChange={set("work")} error={fe("work")}
          hint={tr("reports.describe-your-original-work-and-where")} />
        <TextField label={tr("reports.the-page-on-ndcconnect")} required value={f.url} onChange={set("url")} error={fe("url")}
          hint={tr("reports.paste-the-link-to-the-news")} />
        <Checkbox label={tr("reports.i-own-the-copyright-or-i")} checked={ticks.authority}
          onChange={(e) => setTicks((t) => ({ ...t, authority: e.target.checked }))} error={fe("authority")} />
        <Checkbox label={tr("reports.i-believe-in-good-faith-that")} checked={ticks.good_faith}
          onChange={(e) => setTicks((t) => ({ ...t, good_faith: e.target.checked }))} error={fe("good_faith")} />
        <Checkbox label={tr("reports.the-information-in-this-notice-is")} checked={ticks.accurate}
          onChange={(e) => setTicks((t) => ({ ...t, accurate: e.target.checked }))} error={fe("accurate")} />
        <TextField label={tr("reports.type-your-full-name-as-your")} required value={f.signature} onChange={set("signature")} error={fe("signature")} />
        <Button type="submit" loading={busy} loadingLabel={tr("reports.sending")}>{tr("reports.send-notice")}</Button>
      </form>
    </div>
  );
}
