/** Sections shared by the state page, the LGA page and the finder (spec 19 §6). */
import { Link } from "react-router-dom";
import { formatDate } from "../lib/format";
import { CONSTITUENCY_LABEL } from "./types";
import "./geo.css";

interface LgaRow { id: number; name: string; slug: string; candidates: number; events: number }
interface ConRow { id: number; kind: string; code: string; name: string; candidates: number; lgas: string[] }

/** The state page's "Local government areas" (or "Area councils") and constituencies (§6.1). */
export function LgaList({ state, label, lgas, areaCouncils, constituencies }: {
  state: string; label: string; lgas: LgaRow[]; areaCouncils: boolean; constituencies: ConRow[];
}) {
  const title = areaCouncils ? "Area councils" : "Local government areas";
  const kinds = ["senatorial_district", "federal_constituency", "state_constituency"].filter((k) => constituencies.some((c) => c.kind === k));
  return (
    <>
      <section className="search-section" aria-labelledby="st-lga">
        <div className="search-section__head"><h2 id="st-lga">{title}</h2><span className="news-meta">{lgas.length} in {label}</span></div>
        {lgas.length === 0 ? <p className="news-meta">INEC’s list for {label} isn’t loaded yet.</p> : (
          <ul className="geo-list">
            {lgas.map((l) => (
              <li key={l.id}>
                <Link to={`/states/${state}/${l.slug}`}>{l.name}</Link>
                <p className="news-meta">
                  {l.candidates} candidate{l.candidates === 1 ? "" : "s"} · {l.events} upcoming event{l.events === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {kinds.length > 0 && (
        <section className="search-section" aria-labelledby="st-con">
          <h2 id="st-con">Constituencies</h2>
          {kinds.map((k) => {
            const list = (
              <ul className="geo-list">
                {constituencies.filter((c) => c.kind === k).map((c) => (
                  <li key={c.id}>
                    {c.candidates > 0 ? <Link to={`/candidates?constituency=${c.id}`}>{c.name}</Link> : c.name}
                    <p className="news-meta">{c.lgas.join(", ")}{c.candidates ? ` · ${c.candidates} candidate${c.candidates === 1 ? "" : "s"}` : ""}</p>
                  </li>
                ))}
              </ul>
            );
            // Senatorial districts open; federal and state constituencies in a collapsible list (§6.1)
            return k === "senatorial_district" ? (
              <div key={k} className="state-group"><h3>{CONSTITUENCY_LABEL[k]}s</h3>{list}</div>
            ) : (
              <details key={k} className="state-group geo-details"><summary>{CONSTITUENCY_LABEL[k]}s</summary>{list}</details>
            );
          })}
        </section>
      )}
    </>
  );
}

/** "About this data" (§6.4). */
export function AboutData({ about, inecUrl }: {
  about: { source: string; published_on?: string | null; applied_at?: string; polling_units: number } | null; inecUrl?: string;
}) {
  if (!about) return null;
  const when = about.published_on ? formatDate(about.published_on) : about.applied_at ? formatDate(about.applied_at) : "";
  return (
    <p className="geo-about">
      About this data: from INEC’s polling-unit list{when ? ` published ${when}` : ""} ({about.source}; {about.polling_units.toLocaleString()} polling
      units). {inecUrl ? <a href={inecUrl} target="_blank" rel="noopener noreferrer">INEC’s own portal</a> : "INEC’s own portal"} is the official source.
    </p>
  );
}
