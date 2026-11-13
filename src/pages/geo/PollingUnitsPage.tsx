/**
 * /polling-units — the finder (spec 19 §6.4). INEC's names and codes only, with a link to INEC for the official answer.
 * Never asks for a VIN and never says where anyone votes (rule 7).
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, Select, TextField } from "../../components/ui";
import { AboutData } from "../../geo/GeoSections";
import { CODE_RE, fold, geoApi, useGeoList } from "../../geo/useGeo";
import { lgaWord, type GeoAbout, type GeoLga, type GeoUnit, type GeoUnitDetail, type GeoWard } from "../../geo/types";
import { STATES } from "../../lib/nigeria";
import "../../geo/geo.css";
import "../../search/search.css";
import { t } from "../../i18n";

const INEC_FALLBACK = "https://cvr.inecnigeria.org/pu";

function CheckWithInec({ url }: { url: string }) {
  return <a href={url} target="_blank" rel="noopener noreferrer">{t("geo.check-with-inec")}</a>;
}

export default function PollingUnitsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const state = params.get("state") ?? "";
  const lga = Number(params.get("lga")) || null;
  const ward = Number(params.get("ward")) || null;
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<GeoUnitDetail | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const [busy, setBusy] = useState(false);
  const about = useRequest("geo-about", (signal) => api<GeoAbout>("/geo/about/", { anonymous: true, signal }));
  const inec = about.data?.inec_url || INEC_FALLBACK;
  const lgas = useGeoList<GeoLga>(state ? (a) => geoApi.lgas(a, state) : null, `lgas:${state}`);
  const wards = useGeoList<GeoWard>(lga ? (a) => geoApi.wards(a, lga) : null, `wards:${lga}`);
  const units = useGeoList<GeoUnit>(ward ? (a) => geoApi.units(a, ward) : null, `units:${ward}`);
  useEffect(() => {
    document.title = t("geo.find-a-polling-unit-ndcconnect");
  }, []);
  const shown = useMemo(() => {
    const f = fold(q);
    return f ? units.data.filter((u) => fold(u.name).includes(f) || u.delimitation.includes(f)) : units.data;
  }, [q, units.data]);

  const pick = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
    setQ("");
  };

  const lookUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFound(null);
    setCodeErr("");
    if (!CODE_RE.test(code.trim())) {
      setCodeErr(t("geo.codes-look-like-24-07-05-2"));
      return;
    }
    setBusy(true);
    try {
      setFound(await geoApi.byCode(api, code.trim()));
    } catch (err) {
      setCodeErr(err instanceof ApiError && err.status === 404 ? t("geo.no-polling-unit-has-that-code-2") : t("geo.couldn-t-look-that-up-try"));
    } finally {
      setBusy(false);
    }
  };

  const pu = about.data?.datasets.find((d) => d.kind === "polling_units") ?? null;
  return (
    <div className="states-page">
      <header className="state-head">
        <div>
          <h1>{t("geo.find-a-polling-unit")}</h1>
          <p className="news-meta">{t.rich("geo.inec-s-names-and-codes-for", { checkwithinec: <CheckWithInec url={inec} /> })}</p>
        </div>
      </header>

      <section className="search-section geo-card" aria-labelledby="pu-code">
        <h2 id="pu-code">{t("geo.by-code")}</h2>
        <form onSubmit={(e) => void lookUp(e)} className="geo-picker__code">
          <TextField label={t("geo.polling-unit-code")} value={code} placeholder="24-07-05-004" inputMode="numeric" maxLength={12} error={codeErr}
            onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" variant="secondary" loading={busy}>{t("geo.look-up")}</Button>
        </form>
        {found && (
          <div role="status">
            <p><strong>{found.name}</strong> · {found.delimitation}</p>
            <p className="news-meta">{t("geo.ward-2", { name: found.ward.name, name2: found.lga.name, name3: found.state.name, v: found.active ? "" : t("geo.no-longer-in-inec-s-current-2") })}</p>
            <p><CheckWithInec url={found.inec_url} /></p>
          </div>
        )}
      </section>

      <section className="search-section geo-card" aria-labelledby="pu-browse">
        <h2 id="pu-browse">{t("geo.by-place")}</h2>
        <Select label={t("geo.state")} value={state} placeholder={t("geo.choose-a-state")} options={STATES} onChange={(e) => pick({ state: e.target.value, lga: "", ward: "" })} />
        {state && lgas.loaded && lgas.data.length === 0 ? (
          <p className="news-meta">{t.rich("geo.this-state-s-polling-units-aren", { checkwithinec: <CheckWithInec url={inec} /> })}</p>
        ) : state && (
          <Select label={lgaWord(state)} value={lga ? String(lga) : ""} placeholder={lgas.loading ? t("geo.loading") : t("geo.choose-the-2", { lgaWord: lgaWord(state) })}
            error={lgas.error ? t("geo.couldn-t-load-the-list") : undefined}
            options={lgas.data.map((l) => ({ value: String(l.id), label: `${l.name} · ${l.code}` }))} onChange={(e) => pick({ lga: e.target.value, ward: "" })} />
        )}
        {lga && (
          <Select label={t("geo.ward-registration-area")} value={ward ? String(ward) : ""} placeholder={wards.loading ? t("geo.loading") : t("geo.choose-the-ward")}
            options={wards.data.map((w) => ({ value: String(w.id), label: `${w.name} · ${w.code}` }))} onChange={(e) => pick({ ward: e.target.value })} />
        )}
        {ward && (
          <>
            <TextField label={t("geo.part-of-the-name")} value={q} onChange={(e) => setQ(e.target.value)} />
            {units.error ? <Banner tone="error">{t("geo.couldn-t-load-the-list")}</Banner> : (
              <div className="geo-scroll">
                <table className="geo-table">
                  <caption className="visually-hidden">{t("geo.polling-units-in-this-ward")}</caption>
                  <thead><tr><th scope="col">{t("geo.polling-unit")}</th><th scope="col">{t("geo.code")}</th><th scope="col"><span className="visually-hidden">{t("geo.inec")}</span></th></tr></thead>
                  <tbody>
                    {shown.map((u) => (
                      <tr key={u.id}><td>{u.name}</td><td>{u.delimitation}</td><td><CheckWithInec url={inec} /></td></tr>
                    ))}
                  </tbody>
                </table>
                {!units.loading && shown.length === 0 && <p className="news-meta">{t("geo.no-match-in-this-ward")}</p>}
              </div>
            )}
          </>
        )}
      </section>
      <AboutData about={pu} inecUrl={inec} />
    </div>
  );
}
