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
import { t } from "../../../i18n";

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
    document.title = t("admin.membership-settings-ndcconnect-admin");
  }, []);

  const toggle = async (value: boolean) => {
    setSaving(true);
    try {
      setCfg(await api<MembershipConfig>("/admin/membership/settings/", { method: "PATCH", body: { requires_approval: value } }));
      toast.show({ tone: "success", message: value ? t("admin.officer-approval-is-now-required-after") : t("admin.members-become-active-as-soon-as") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-save") });
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
      toast.show({ tone: "success", message: t("admin.downloaded-this-export-is-recorded-in") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof Error ? err.message : t("admin.export-failed") });
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="adm-page">
      <AdminNav current="membership" />
      <header className="adm-page__head"><div><h1>{t("admin.settings-and-register")}</h1></div></header>
      <MembershipSubnav />
      {!cfg ? <Skeleton width="100%" height={120} /> : (
        <div className="adm-donation-grid">
          <section className="adm-panel" aria-labelledby="approval-h">
            <h2 id="approval-h">{t("admin.approval")}</h2>
            <Switch label={t("admin.require-officer-approval-after-payment")} checked={cfg.requires_approval} onChange={(v) => void toggle(v)}
              disabled={!me?.is_system_admin || saving}
              hint={me?.is_system_admin ? t("admin.changes-are-audited") : t("admin.only-a-system-admin-can-change")} />
            <p className="ds-field__hint">{t("admin.membership-fee-set-in-server-settings", { formatKobo: formatKobo(cfg.fee_kobo), v: cfg.open ? t("admin.open-3") : t("admin.closed-2") })}</p>
          </section>
          <section className="adm-panel" aria-labelledby="register-h">
            <h2 id="register-h">{t("admin.inec-register-export")}</h2>
            <p>{t("admin.active-members-only-in-the-electoral")}</p>
            <Banner tone="warning">{t("admin.this-file-contains-nins-and-photos")}</Banner>
            <Select label={t("admin.state")} value={state} onChange={(e) => setState(e.target.value)} options={[{ value: "", label: t("admin.all-states") }, ...STATES]} />
            <div className="adm-actions">
              <Button onClick={() => void exportRegister("csv")} loading={exporting === "csv"} loadingLabel={t("admin.exporting")}>{t("admin.download-register-csv")}</Button>
              <Button variant="secondary" onClick={() => void exportRegister("zip")} loading={exporting === "zip"} loadingLabel={t("admin.exporting")}>{t("admin.download-photos-zip")}</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
