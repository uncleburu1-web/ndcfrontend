/** The Appeals tab (spec 13 §4.3, §8.2). Decide is hidden for the original decider; the server refuses anyway (same_decider). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { useRequest } from "../candidates/useRequest";
import { Banner, Button, EmptyState, Modal, RadioGroup, Skeleton, StatusBadge, TextArea, useToast } from "../components/ui";
import { formatDate } from "../lib/format";
import type { AppealRow } from "./types";
import { KIND_LABEL } from "./words";
import "./moderation.css";

export function AppealsList({ status = "pending" }: { status?: "pending" | "decided" }) {
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`appeals:${status}`, (signal) => api<{ results: AppealRow[] }>(`/admin/moderation/appeals/?status=${status}`, { signal }));
  const [deciding, setDeciding] = useState<AppealRow | null>(null);
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async () => {
    if (!deciding) return;
    setBusy(true);
    try {
      await api(`/admin/moderation/appeals/${deciding.id}/decide/`, { method: "POST", body: { upheld: outcome === "upheld", reason } });
      toast.show({ tone: "success", message: outcome === "upheld" ? "Upheld. The content is back (or the pause lifted) and the author is told." : "Not upheld. The author sees your reason." });
      setDeciding(null);
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work." });
    } finally {
      setBusy(false);
    }
  };

  if (res.error) return <Banner tone="error" title="We couldn’t load appeals" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>;
  if (!res.data) return <Skeleton width="100%" height={160} />;
  if (!res.data.results.length) return <EmptyState title={status === "pending" ? "No appeals waiting" : "No decided appeals yet"} />;
  return (
    <>
      <ul className="mod-list">
        {res.data.results.map((a) => (
          <li key={a.id} className="mod-list__item">
            <StatusBadge set="appeal" status={a.status} />
            <h3>{a.kind === "pause" ? "Community news pause" : `${KIND_LABEL[a.target_kind ?? "article"]}: ${a.title}`}</h3>
            <p className="mod-meta">
              Appealed {formatDate(a.created_at, { withTime: true })} · original decision{a.original.rule ? ` under ${a.original.rule}: ${a.original.rule_title}` : ""}
              {a.original.decided_at ? ` on ${formatDate(a.original.decided_at)}` : ""}
            </p>
            <p className="mod-body">{a.statement}</p>
            {a.evidence_url && <p className="mod-meta">Evidence: <a href={a.evidence_url} target="_blank" rel="noopener noreferrer nofollow">{a.evidence_url}</a></p>}
            {a.decision_reason && <p className="mod-meta">Reason given: {a.decision_reason}</p>}
            <div className="mod-row-actions">
              {a.case && <Button size="sm" variant="secondary" href={`/admin/moderation/${a.case}`}>Open the case</Button>}
              {a.can_decide && <Button size="sm" onClick={() => { setDeciding(a); setOutcome(""); setReason(""); }}>Decide</Button>}
              {a.status === "pending" && a.own_decision && <span className="mod-meta">You made the original decision, so someone else decides this appeal.</span>}
            </div>
          </li>
        ))}
      </ul>
      <Modal open={Boolean(deciding)} onClose={() => setDeciding(null)} title="Decide this appeal"
        footer={<><Button variant="secondary" onClick={() => setDeciding(null)}>Go back</Button>
          <Button onClick={() => void decide()} loading={busy} disabled={!outcome || (outcome === "denied" && !reason.trim())}>Save decision</Button></>}>
        {deciding && (
          <>
            <p><strong>Original decision:</strong> {deciding.original.rule ? `${deciding.original.rule}: ${deciding.original.rule_title}` : "community rules"}
              {deciding.original.note ? ` — ${deciding.original.note}` : ""}{deciding.original.ends_at ? ` (paused until ${formatDate(deciding.original.ends_at)})` : ""}</p>
            <p><strong>The author says:</strong></p>
            <p className="mod-body">{deciding.statement}</p>
            {deciding.case && <p><Link to={`/admin/moderation/${deciding.case}`}>See the item and history</Link></p>}
            <RadioGroup legend="Outcome" name="appeal-outcome" required value={outcome} onChange={setOutcome} options={[
              { value: "upheld", label: deciding.kind === "pause" ? "Upheld: lift the pause" : "Upheld: restore the content" },
              { value: "denied", label: "Not upheld: the decision stands" },
            ]} />
            <TextArea label={outcome === "denied" ? "Reason (shown to the author)" : "Reason (optional, shown to the author)"} required={outcome === "denied"}
              rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="ds-field__hint">Both outcomes are final on NDCConnect.</p>
          </>
        )}
      </Modal>
    </>
  );
}
