/** Building blocks of the Admin home (spec 11 §4.2, §8.1). Severity is always in words and icon, never colour alone. */
import { Link } from "react-router-dom";
import { Icon } from "../components/ui";
import { formatAge, formatDate, formatNaira } from "../lib/format";
import type { AttentionCardData, AuditEntry, JobRow, ReadinessItem, StatData } from "./types";
import "./admin-home.css";

const SEVERITY: Record<string, { words: string; icon: "checkCircle" | "alert" | "xCircle" | "info" }> = {
  ok: { words: "On time", icon: "checkCircle" },
  warning: { words: "Over target", icon: "alert" },
  error: { words: "Needs action", icon: "xCircle" },
  info: { words: "For information", icon: "info" },
};

function target(c: AttentionCardData) {
  if (c.target_hours) return `Target: ${c.target_hours} hours`;
  if (c.target_working_days) return `Target: ${c.target_working_days} working days`;
  if (c.any_is_warning) return "Check each one";
  return "";
}

export function AttentionCard({ card }: { card: AttentionCardData }) {
  const sev = card.any_is_warning && card.severity === "warning" ? { words: "Needs checking", icon: "alert" as const } : SEVERITY[card.severity];
  return (
    <li className={`adm-attn adm-attn--${card.severity}`}>
      <p className="adm-attn__count" aria-hidden="true">{card.count.toLocaleString()}</p>
      <div className="adm-attn__body">
        <h3>
          <span className="visually-hidden">{card.count.toLocaleString()} </span>
          {card.label}
        </h3>
        <p className="adm-attn__meta">
          {card.count > 0 && card.oldest_at && <>Oldest: {formatAge(card.oldest_at)} · </>}
          {target(card)}
        </p>
        {card.count > 0 && (
          <p className={`adm-sev adm-sev--${card.severity}`}>
            <Icon name={sev.icon} size={16} /> {sev.words}
          </p>
        )}
      </div>
      <Link className="adm-attn__open" to={card.href} aria-label={`Open ${card.label}`}>Open</Link>
    </li>
  );
}

function delta(s: StatData) {
  if (s.this_week === null || s.this_week === undefined) return null;
  const fmt = (n: number) => (s.kobo ? formatNaira(n / 100) : n.toLocaleString());
  const last = s.last_week ?? 0;
  const dir = s.this_week > last ? "up" : s.this_week < last ? "down" : "same";
  const words = dir === "same" ? `same as last week` : `${dir} from ${fmt(last)} last week`;
  return (
    <p className="adm-stat__delta">
      <span>+{fmt(s.this_week)} this week</span>
      <span className={`adm-stat__dir adm-stat__dir--${dir}`}>
        <span aria-hidden="true">{dir === "up" ? "↑" : dir === "down" ? "↓" : "→"}</span> {words}
      </span>
    </p>
  );
}

export function StatTile({ stat }: { stat: StatData }) {
  return (
    <li className="adm-stat">
      <p className="adm-stat__label">{stat.label}</p>
      <p className="adm-stat__total">{stat.kobo ? formatNaira(stat.total / 100) : stat.total.toLocaleString()}</p>
      {delta(stat)}
    </li>
  );
}

const READY: Record<string, { words: string; icon: "checkCircle" | "xCircle" | "alert" | "info" }> = {
  ready: { words: "Ready", icon: "checkCircle" },
  not_set: { words: "Not set", icon: "xCircle" },
  warning: { words: "Check", icon: "alert" },
  error: { words: "Problem", icon: "xCircle" },
  info: { words: "", icon: "info" },
};
const READY_GROUPS: Record<string, string> = {
  donations: "Donations", membership: "Membership", signin: "Sign-in", payments: "Payments", inec: "INEC links",
  security: "Security", media: "Media storage", integrations: "Integrations",
};

export function ReadinessList({ items }: { items: ReadinessItem[] }) {
  const groups = Array.from(new Set(items.map((i) => i.group)));
  return (
    <div className="adm-ready">
      {groups.map((g) => (
        <section key={g} aria-label={READY_GROUPS[g] ?? g}>
          <h3>{READY_GROUPS[g] ?? g}</h3>
          <ul>
            {items.filter((i) => i.group === g).map((i) => (
              <li key={i.label} className={`adm-ready__item adm-ready__item--${i.state}`}>
                <Icon name={READY[i.state].icon} size={16} />
                <span>
                  {i.label}
                  {READY[i.state].words && <>: <strong>{READY[i.state].words}</strong></>}
                  {i.detail && <span className="adm-muted"> · {i.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function JobsList({ jobs }: { jobs: JobRow[] }) {
  return (
    <ul className="adm-jobs">
      {jobs.map((j) => {
        const bad = j.state === "failed" || j.state === "stalled" || j.state === "overdue";
        return (
          <li key={j.job} className={bad ? "adm-jobs__item adm-jobs__item--bad" : "adm-jobs__item"}>
            <Icon name={bad ? "xCircle" : j.state === "ok" ? "checkCircle" : j.state === "running" ? "clock" : "minusCircle"} size={16} />
            <span>
              <strong>{j.label}</strong>: {j.state_label}
              {j.finished_at && <span className="adm-muted"> · {formatDate(j.finished_at, { withTime: true })}</span>}
              {j.manual && j.state === "never" && <span className="adm-muted"> · run by hand</span>}
              {(j.error || j.summary) && <span className="adm-muted"> · {j.error || j.summary}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityRow({ e }: { e: AuditEntry }) {
  return (
    <li className="adm-activity__item">
      <span className="adm-muted">{formatDate(e.created_at, { withTime: true })}</span>
      <span>
        <strong>{e.actor}</strong> {e.action_label}
        {e.link ? <> · <Link to={e.link}>{e.target_label || "Open"}</Link></> : e.target_label ? <> · {e.target_label}</> : null}
        {e.summary && <span className="adm-muted"> · {e.summary}</span>}
      </span>
    </li>
  );
}
