/**
 * "Confirm where you vote" on the Account page (spec 19 §8.1). Shown only while a membership or PVC record has a
 * location that nobody has confirmed, or points at a unit INEC retired. Pre-filled with the best suggestion.
 * On a verified PVC check the choice waits for an officer; community placement doesn't change until then.
 */
import { useState } from "react";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { useRequest } from "../candidates/useRequest";
import { Button, useToast } from "../components/ui";
import { stateLabel } from "../lib/nigeria";
import { GeoPicker } from "./GeoPicker";
import { geoBody, type ConfirmItem, type ConfirmResult, type GeoValue } from "./types";
import "./geo.css";
import { t } from "../i18n";

function initial(item: ConfirmItem): GeoValue {
  const s = item.suggestion;
  return { lga_id: s.lga?.id ?? null, ward_id: s.ward?.id ?? null, polling_unit_id: s.polling_unit?.id ?? null, not_listed: false,
    lga: item.typed.lga, ward: item.typed.ward, polling_unit: item.typed.polling_unit };
}

function One({ item, onDone }: { item: ConfirmItem; onDone: (msg: string) => void }) {
  const api = useApi();
  const [value, setValue] = useState<GeoValue>(() => initial(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const what = item.kind === "pvc" ? "PVC check" : "membership";
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api<ConfirmResult>(`/me/geo-confirm/${item.kind}/`, { method: "POST", body: geoBody(value) });
      onDone(r.waits_for_officer ? t("geo.saved-a-pvc-officer-checks-the") : t("geo.saved-thank-you"));
    } catch (err) {
      if (err instanceof ApiError) {
        const field = String(err.extra.field ?? "").replace(/_id$/, "");
        setErrors(field ? { [field]: err.message } : {});
        if (!field) onDone("");
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="geo-card" onSubmit={(e) => void save(e)} aria-labelledby={`gc-${item.kind}`}>
      <h3 id={`gc-${item.kind}`}>{t("geo.your", { what, stateLabel: stateLabel(item.state) })}</h3>
      <p className="news-meta">
        {item.retired ? t("geo.inec-changed-the-polling-unit-on") : t("geo.you-typed-choose-it-from-inec", { v: [item.typed.lga, item.typed.ward, item.typed.polling_unit].filter(Boolean).join(" · ") || t("geo.nothing-yet") })}
      </p>
      <GeoPicker state={item.state} value={value} onChange={setValue} errors={errors} required={["lga"]} />
      <div className="geo-actions"><Button type="submit" loading={busy}>{t("geo.confirm")}</Button></div>
    </form>
  );
}

export function GeoConfirmCard() {
  const api = useApi();
  const toast = useToast();
  const [nonce, setNonce] = useState(0);
  const res = useRequest(`geo-confirm:${nonce}`, (signal) => api<{ results: ConfirmItem[] }>("/me/geo-confirm/", { signal }));
  const items = Array.isArray(res.data?.results) ? res.data.results : [];
  if (!items.length) return null;
  return (
    <section className="account-voter" aria-labelledby="geo-confirm-h">
      <h2 id="geo-confirm-h">{t("geo.confirm-where-you-vote")}</h2>
      <p className="news-meta">{t("geo.only-you-and-the-officers-who")}</p>
      {items.map((i) => (
        <One key={i.kind} item={i} onDone={(msg) => {
          if (msg) toast.show({ tone: "success", message: msg });
          else toast.show({ tone: "error", message: t("geo.that-didn-t-save-try-again") });
          setNonce((n) => n + 1);
        }} />
      ))}
    </section>
  );
}
