/** /admin/pvc/settings — "Get your PVC" guidance (spec 08 §4.5). System admins edit; PVC officers can read. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi, useMe } from "../../../auth/session";
import { Banner, Button, Skeleton, TextArea, useToast } from "../../../components/ui";
import type { PvcConfig } from "../../../pvc/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "./admin-pvc.css";

export default function AdminPvcSettingsPage() {
  const api = useApi();
  const toast = useToast();
  const { me } = useMe();
  const canEdit = Boolean(me?.is_system_admin);
  const [cfg, setCfg] = useState<PvcConfig | null>(null);
  const [f, setF] = useState({ guidance_note: "", collection_note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "PVC guidance | NDCConnect admin";
    api<PvcConfig>("/admin/pvc/settings/").then((c) => {
      setCfg(c);
      setF({ guidance_note: c.guidance_note, collection_note: c.collection_note });
    }).catch((e) => setError(e instanceof ApiError ? e.message : "Couldn’t load settings."));
  }, [api]);

  const save = async () => {
    setBusy(true);
    try {
      setCfg(await api<PvcConfig>("/admin/pvc/settings/", { method: "PATCH", body: f }));
      toast.show({ tone: "success", message: "Saved. It shows on /pvc within a few minutes." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-page">
      <AdminNav current="pvc" />
      <p className="adm-back"><Link to="/admin/pvc">← PVC checks</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>“Get your PVC” guidance</h1>
          <p className="ds-field__hint">Shown on the public PVC page. Plain text. Changes are audited.</p>
        </div>
      </header>
      {error && <Banner tone="error">{error}</Banner>}
      {!cfg && !error ? <Skeleton width="100%" height={200} /> : cfg && (
        <div className="adm-panel adm-pvc-settings">
          {!canEdit && <Banner tone="info">Only a system admin can change these.</Banner>}
          <TextArea label="Collection note" rows={3} maxLength={500} value={f.collection_note} disabled={!canEdit}
            onChange={(e) => setF({ ...f, collection_note: e.target.value })} hint={`${f.collection_note.length} / 500`} />
          <TextArea label="Current guidance (optional)" rows={4} maxLength={1000} value={f.guidance_note} disabled={!canEdit}
            onChange={(e) => setF({ ...f, guidance_note: e.target.value })}
            hint={`${f.guidance_note.length} / 1,000 · e.g. “Registration is closed until INEC announces the next phase.”`} />
          <dl className="adm-dl">
            <div><dt>Voter checker</dt><dd>{cfg.inec_voter_check_url}</dd></div>
            <div><dt>INEC portal</dt><dd>{cfg.inec_pvc_url ?? "Not set: the “Register, transfer or replace” button is hidden"}</dd></div>
          </dl>
          <p className="ds-field__hint">INEC addresses are server settings (they must be verified official URLs), not editable here.</p>
          {canEdit && <Button onClick={() => void save()} loading={busy} loadingLabel="Saving…">Save guidance</Button>}
        </div>
      )}
    </div>
  );
}
