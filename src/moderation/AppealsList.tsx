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
import { t } from "../i18n";

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
      toast.show({ tone: "success", message: outcome === "upheld" ? t("moderation.upheld-the-content-is-back-or") : t("moderation.not-upheld-the-author-sees-your") });
      setDeciding(null);
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("moderation.that-didn-t-work") });
    } finally {
      setBusy(false);
    }
  };

  if (res.error) return <Banner tone="error" title={t("moderation.we-couldn-t-load-appeals")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("moderation.try-again")}</Button>}>{res.error.message}</Banner>;
  if (!res.data) return <Skeleton width="100%" height={160} />;
  if (!res.data.results.length) return <EmptyState title={status === "pending" ? t("moderation.no-appeals-waiting") : t("moderation.no-decided-appeals-yet")} />;
  return (
    <>
      <ul className="mod-list">
        {res.data.results.map((a) => (
          <li key={a.id} className="mod-list__item">
            <StatusBadge set="appeal" status={a.status} />
            <h3>{a.kind === "pause" ? t("moderation.community-news-pause") : `${KIND_LABEL[a.target_kind ?? "article"]}: ${a.title}`}</h3>
            <p className="mod-meta">
              {t("moderation.appealed-original-decision", { formatDate: formatDate(a.created_at, { withTime: true }), v: a.original.rule ? t("moderation.under", { rule: a.original.rule, rule_title: a.original.rule_title }) : "", v2: a.original.decided_at ? t("moderation.on", { formatDate: formatDate(a.original.decided_at) }) : "" })}
            </p>
            <p className="mod-body">{a.statement}</p>
            {a.evidence_url && <p className="mod-meta">{t.rich("moderation.evidence", { evidence_url: a.evidence_url, a: (chunks) => <a href={a.evidence_url} target="_blank" rel="noopener noreferrer nofollow">{chunks}</a> })}</p>}
            {a.decision_reason && <p className="mod-meta">{t("moderation.reason-given", { decision_reason: a.decision_reason })}</p>}
            <div className="mod-row-actions">
              {a.case && <Button size="sm" variant="secondary" href={`/admin/moderation/${a.case}`}>{t("moderation.open-the-case")}</Button>}
              {a.can_decide && <Button size="sm" onClick={() => { setDeciding(a); setOutcome(""); setReason(""); }}>{t("moderation.decide")}</Button>}
              {a.status === "pending" && a.own_decision && <span className="mod-meta">{t("moderation.you-made-the-original-decision-so")}</span>}
            </div>
          </li>
        ))}
      </ul>
      <Modal open={Boolean(deciding)} onClose={() => setDeciding(null)} title={t("moderation.decide-this-appeal")}
        footer={<><Button variant="secondary" onClick={() => setDeciding(null)}>{t("moderation.go-back")}</Button>
          <Button onClick={() => void decide()} loading={busy} disabled={!outcome || (outcome === "denied" && !reason.trim())}>{t("moderation.save-decision")}</Button></>}>
        {deciding && (
          <>
            <p><strong>{t("moderation.original-decision")}</strong> {deciding.original.rule ? `${deciding.original.rule}: ${deciding.original.rule_title}` : t("moderation.community-rules")}
              {deciding.original.note ? ` — ${deciding.original.note}` : ""}{deciding.original.ends_at ? t("moderation.paused-until", { formatDate: formatDate(deciding.original.ends_at) }) : ""}</p>
            <p><strong>{t("moderation.the-author-says")}</strong></p>
            <p className="mod-body">{deciding.statement}</p>
            {deciding.case && <p><Link to={`/admin/moderation/${deciding.case}`}>{t("moderation.see-the-item-and-history")}</Link></p>}
            <RadioGroup legend={t("moderation.outcome")} name="appeal-outcome" required value={outcome} onChange={setOutcome} options={[
              { value: "upheld", label: deciding.kind === "pause" ? t("moderation.upheld-lift-the-pause") : t("moderation.upheld-restore-the-content") },
              { value: "denied", label: t("moderation.not-upheld-the-decision-stands") },
            ]} />
            <TextArea label={outcome === "denied" ? t("moderation.reason-shown-to-the-author") : t("moderation.reason-optional-shown-to-the-author")} required={outcome === "denied"}
              rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="ds-field__hint">{t("moderation.both-outcomes-are-final-on-ndcconnect")}</p>
          </>
        )}
      </Modal>
    </>
  );
}
