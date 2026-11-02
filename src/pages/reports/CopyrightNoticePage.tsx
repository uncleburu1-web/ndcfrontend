/** /report/copyright — a copyright notice with the Copyright Act 2022 s. 54(2) details, in plain English (spec 13 §4.7). */
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useAuth } from "@clerk/react";
import { Banner, Button, Checkbox, TextArea, TextField } from "../../components/ui";
import "../../moderation/moderation.css";

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
    document.title = "Copyright notice | NDCConnect";
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
      } else setError("We couldn’t send your notice.");
    } finally {
      setBusy(false);
    }
  };
  const fe = (k: string) => errors[k]?.[0];

  if (reference) {
    return (
      <div className="mod-page">
        <h1>Copyright notice received</h1>
        <p className="mod-ref"><strong>{reference}</strong></p>
        <p>We’ll review it and may contact you. Keep the reference to check progress at <Link to="/reports/status">Check a report</Link>.</p>
      </div>
    );
  }
  return (
    <div className="mod-page">
      <h1>Send a copyright notice</h1>
      <p className="mod-lead">
        Use this if something on NDCConnect uses your work (a photo, article or video) without permission. The Copyright Act 2022 (s. 54)
        asks for each item below. We may share your notice with the person who posted the content so they can respond.
      </p>
      {error && <Banner tone="error">{error}</Banner>}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <TextField label="Your name" required value={f.name} onChange={set("name")} error={fe("name")} autoComplete="name" />
        <TextField label="How we can contact you" required value={f.contact} onChange={set("contact")} error={fe("contact")}
          hint="An email address or phone number." />
        <TextArea label="The work that was copied" required rows={3} value={f.work} onChange={set("work")} error={fe("work")}
          hint="Describe your original work, and where it was first published if you can." />
        <TextField label="The page on NDCConnect" required value={f.url} onChange={set("url")} error={fe("url")}
          hint="Paste the link to the news story or candidate post." />
        <Checkbox label="I own the copyright, or I’m allowed to act for the owner." checked={ticks.authority}
          onChange={(e) => setTicks((t) => ({ ...t, authority: e.target.checked }))} error={fe("authority")} />
        <Checkbox label="I believe in good faith that this use isn’t allowed by the owner or the law." checked={ticks.good_faith}
          onChange={(e) => setTicks((t) => ({ ...t, good_faith: e.target.checked }))} error={fe("good_faith")} />
        <Checkbox label="The information in this notice is accurate." checked={ticks.accurate}
          onChange={(e) => setTicks((t) => ({ ...t, accurate: e.target.checked }))} error={fe("accurate")} />
        <TextField label="Type your full name as your signature" required value={f.signature} onChange={set("signature")} error={fe("signature")} />
        <Button type="submit" loading={busy} loadingLabel="Sending…">Send notice</Button>
      </form>
    </div>
  );
}
