/** /admin/membership/settings — approval switch (system admin) and the INEC register export (spec 06 §4.4). */
import { useEffect, useState } from "react";
import { ApiError } from "../../../auth/api";
import { useApi, useMe } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Select, Skeleton, Switch, useToast } from "../../../components/ui";
import { formatKobo } from "../../../donations/money";
import { STATES } from "../../../lib/nigeria";
import type { MembershipConfig } from "../../../membership/types";
import { AdminNav } from "../AdminNav";
import { MembershipSubnav } from "./MembershipSubnav";
import { saveBlob } from "./download";
import "../candidates/admin.css";
import "./admin-membership.css";

export default function AdminMembershipSettingsPage() {
  const api = useApi();
  const toast = useToast();
  const { me } = useMe();
  const res = useRequest("admin-membership-settings", (signal) => api<MembershipConfig>("/admin/membership/settings/", { signal }));
  const [cfg, setCfg] = useState<MembershipConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState("");
  const [exporting, setExporting] = useState<"" | "csv" | "zip">("");

  useEffect(() => setCfg(res.data), [res.data]);
  useEffect(() => {
    document.title = "Membership settings | NDCConnect admin";
  }, []);

  const toggle = async (value: boolean) => {
    setSaving(true);
    try {
      setCfg(await api<MembershipConfig>("/admin/membership/settings/", { method: "PATCH", body: { requires_approval: value } }));
      toast.show({ tone: "success", message: value ? "Officer approval is now required after payment." : "Members become active as soon as payment is confirmed." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save." });
    } finally {
      setSaving(false);
    }
  };
  const exportRegister = async (kind: "csv" | "zip") => {
    setExporting(kind);
    const day = new Date().toISOString().slice(0, 10);
    const path = kind === "csv" ? "register.csv" : "register-photos.zip";
    try {
      const blob = await api<Blob>(`/admin/membership/${path}${state ? `?state=${state}` : ""}`, { responseType: "blob" });
      saveBlob(blob, kind === "csv" ? `ndc-register-${state || "all"}-${day}.csv` : `ndc-register-photos-${state || "all"}-${day}.zip`);
      toast.show({ tone: "success", message: "Downloaded. This export is recorded in the audit log." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof Error ? err.message : "Export failed." });
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="adm-page">
      <AdminNav current="membership" />
      <header className="adm-page__head"><div><h1>Settings and register</h1></div></header>
      <MembershipSubnav />
      {!cfg ? <Skeleton width="100%" height={120} /> : (
        <div className="adm-donation-grid">
          <section className="adm-panel" aria-labelledby="approval-h">
            <h2 id="approval-h">Approval</h2>
            <Switch label="Require officer approval after payment" checked={cfg.requires_approval} onChange={(v) => void toggle(v)}
              disabled={!me?.is_system_admin || saving}
              hint={me?.is_system_admin ? "Changes are audited." : "Only a system admin can change this."} />
            <p className="ds-field__hint">Membership fee: {formatKobo(cfg.fee_kobo)} (set in server settings). Registration is {cfg.open ? "open" : "closed"}.</p>
          </section>
          <section className="adm-panel" aria-labelledby="register-h">
            <h2 id="register-h">INEC register export</h2>
            <p>Active members only, in the Electoral Act 2026 s. 77(2) field order plus membership number and join date. Photos come as a separate ZIP named by membership number.</p>
            <Banner tone="warning">This file contains NINs and photos. Store it securely and delete it after submitting to INEC.</Banner>
            <Select label="State" value={state} onChange={(e) => setState(e.target.value)} options={[{ value: "", label: "All states" }, ...STATES]} />
            <div className="adm-actions">
              <Button onClick={() => void exportRegister("csv")} loading={exporting === "csv"} loadingLabel="Exporting…">Download register (CSV)</Button>
              <Button variant="secondary" onClick={() => void exportRegister("zip")} loading={exporting === "zip"} loadingLabel="Exporting…">Download photos (ZIP)</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
