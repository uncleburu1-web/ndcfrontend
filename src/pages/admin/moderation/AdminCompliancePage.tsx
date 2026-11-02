/** /admin/moderation/compliance — every NITDA annual-report figure for a year, with definitions; CSV is audited (spec 13 §4.8). */
import { useEffect, useState } from "react";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Select, Skeleton, useToast } from "../../../components/ui";
import type { ComplianceReport } from "../../../moderation/types";
import { RULE_TITLES } from "../../../moderation/rules";
import { saveBlob } from "../membership/download";
import { AdminNav } from "../AdminNav";
import { ModerationNav } from "./ModerationNav";
import "../candidates/admin.css";
import "../../../moderation/moderation.css";

export default function AdminCompliancePage() {
  const api = useApi();
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const res = useRequest(`compliance:${year}`, (signal) => api<ComplianceReport>(`/admin/moderation/compliance/?year=${year}`, { signal }));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = "Compliance report | NDCConnect admin";
  }, []);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await api<Blob>(`/admin/moderation/compliance/?year=${year}&format=csv`, { responseType: "blob" });
      saveBlob(blob, `ndcconnect-nitda-compliance-${year}.csv`);
      toast.show({ tone: "success", message: "Downloaded. Downloads are recorded in the audit log." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Download failed." });
    } finally {
      setBusy(false);
    }
  };
  const years = res.data?.years ?? [year];
  return (
    <div className="adm-page">
      <AdminNav current="moderation" />
      <ModerationNav current="compliance" />
      <header className="adm-page__head">
        <div>
          <h1>Compliance report</h1>
          <p className="ds-field__hint">Figures for the NITDA Code of Practice annual report: counts for 1 January to 31 December, Lagos time. No personal data.</p>
        </div>
        <div className="adm-actions">
          <Select label="Year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))} />
          <Button variant="secondary" onClick={() => void download()} loading={busy} loadingLabel="Preparing…">Download CSV</Button>
        </div>
      </header>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load the figures" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={240} />
      ) : (
        <>
          {res.data.frozen && <Banner tone="info">These figures were frozen when old case records were cleared.</Banner>}
          <div className="adm-table-wrap">
            <table className="mod-figures">
              <caption className="visually-hidden">NITDA annual report figures for {res.data.year}</caption>
              <thead><tr><th scope="col">Item</th><th scope="col">Figure</th><th scope="col">How it’s counted</th></tr></thead>
              <tbody>
                {res.data.items.map((i) => (
                  <tr key={i.key}>
                    <th scope="row">{i.label}</th>
                    <td>{typeof i.value === "number" ? i.value.toLocaleString() : i.value}{i.key === "large_platform" ? ` (${res.data!.registered_users.toLocaleString()} accounts)` : ""}</td>
                    <td className="mod-meta">{i.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Protecting people from harmful content</h2>
          <p>{res.data.safety_statement}</p>
          <ul>
            {Object.entries(res.data.harmful_by_rule).map(([r, n]) => <li key={r}>{r} {RULE_TITLES[r]}: {n} removals</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
