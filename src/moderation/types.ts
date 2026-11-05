/** Reporting and moderation (spec 13). Shapes mirror ndcbackend/apps/moderation. */
export type TargetKind = "article" | "post" | "candidate" | "community_post" | "community_comment";
export type Priority = "legal" | "urgent" | "high" | "normal" | "low";
export type CaseStatus = "open" | "escalated" | "closed";
export type Decision = "" | "kept" | "removed" | "restored" | "author_removed";

export interface Rule {
  id: string;
  title: string;
  summary: string;
  examples: string[];
  law: string;
}

export interface RulesPayload {
  version: number;
  updated: string;
  draft: boolean;
  rules: Rule[];
  changes: { date: string; text: string }[];
  reasons: { reason: string; label: string; rule: string }[];
  profile_reasons: { reason: string; label: string }[];
  legal_email: string;
  counter_notice_days: number;
  appeal_days: number;
}

/** The 410 body for a removed article or post (spec 13 §4.5). */
export interface RemovalNotice {
  removed: true;
  rule: string;
  rule_title: string;
  kind: string;
  source: "rules" | "copyright" | "legal";
}

export interface CaseRow {
  id: string;
  target_kind: TargetKind;
  kind_label: string;
  title: string;
  state: string;
  status: CaseStatus;
  priority: Priority;
  priority_label: string;
  legal_due_at: string | null;
  due: { due_at: string; overdue: boolean; hours: number } | null;
  opened_at: string;
  closed_at: string | null;
  decision: Decision;
  rule: string;
  source: string;
  report_count: number;
  top_reason: { reason: string; label: string } | null;
  burst_flag: boolean;
  legal_hold: boolean;
  restorable: boolean;
  assigned_to: { id: string; email: string; me: boolean } | null;
}

export interface CaseReport {
  id: string;
  reference: string;
  reason: string;
  reason_label: string;
  details: string;
  created_at: string;
  status: "open" | "actioned" | "dismissed";
  reporter_label: string;
  contact_email: string;
  signed_in: boolean;
}

export interface CaseDetail extends CaseRow {
  item: {
    kind: TargetKind;
    kind_words: string;
    title: string;
    public_url: string;
    admin_url: string;
    public: boolean;
    status: string;
    body: string;
    official?: boolean;
    candidate?: { slug: string; full_name: string };
    /** Spec 17: community posts and comments */
    community?: { id: string; name: string; path: string; level: string };
    hidden_at?: string | null;
    author: { email?: string; name?: string; label?: string } | null;
  } | null;
  reports: CaseReport[];
  note_to_author: string;
  internal_note: string;
  decided_by: string | null;
  decided_at: string | null;
  escalated: boolean;
  history: { event: string; note: string; created_at: string; actor: string | null }[];
  notices: { id: string; reference: string; kind: string; kind_label: string; outcome: string }[];
  appeals: { id: string; status: string; status_label: string; statement: string; evidence_url: string; created_at: string; decision_reason: string }[];
  standing: {
    user_id: string;
    removals: number;
    warnings: number;
    pauses: number;
    paused_until: string | null;
    suggestion: string;
    active_pause: { id: string; ends_at: string } | null;
    pause_kind?: "news_pause" | "community_pause";
  } | null;
  blocked: string;
  blocked_message?: string;
  is_system_admin: boolean;
  rules: { id: string; title: string }[];
}

export interface AppealRow {
  id: string;
  kind: "removal" | "pause";
  kind_label: string;
  status: "pending" | "upheld" | "denied";
  status_label: string;
  statement: string;
  evidence_url: string;
  created_at: string;
  decided_at: string | null;
  decision_reason: string;
  case: string | null;
  title: string;
  target_kind: TargetKind | null;
  original: { rule: string; rule_title: string; note: string; decided_at: string | null; ends_at: string | null };
  can_decide: boolean;
  own_decision: boolean;
}

export interface MyAppeal {
  id: string;
  status: "pending" | "upheld" | "denied";
  status_label: string;
  created_at: string;
  decided_at: string | null;
  reason: string;
}

export interface AuthorView {
  paused_until: string | null;
  removals: {
    case: string;
    target_kind: TargetKind;
    target_id: string;
    title: string;
    rule: string;
    rule_title: string;
    note_to_author: string;
    decided_at: string;
    decision: Decision;
    source: string;
    can_appeal: boolean;
    appeal_until: string;
    appeal: MyAppeal | null;
    copyright_notice: string | null;
    can_counter_notice: boolean;
  }[];
  restrictions: {
    id: string;
    kind: "warning" | "news_pause" | "community_pause";
    kind_label: string;
    rule: string;
    rule_title: string;
    reason: string;
    starts_at: string;
    ends_at: string | null;
    lifted_at: string | null;
    active: boolean;
    can_appeal: boolean;
    appeal: MyAppeal | null;
  }[];
}

export interface MyReport {
  reference: string;
  target_kind: TargetKind;
  title: string;
  reason: string;
  reason_label: string;
  status: "open" | "actioned" | "dismissed";
  status_label: string;
  created_at: string;
  resolved_at: string | null;
}

export interface LegalNoticeRow {
  id: string;
  reference: string;
  kind: "agency" | "court_order" | "copyright";
  kind_label: string;
  sender_name: string;
  sender_org: string;
  received_at: string;
  due_at: string | null;
  status: "open" | "closed";
  overdue: boolean;
  acknowledged_at: string | null;
  items: number;
  pending_items: number;
}

export interface LegalNoticeDetail extends LegalNoticeRow {
  sender_contact: string;
  sender_reference: string;
  legal_basis: string;
  acknowledged_how: string;
  has_attachment: boolean;
  work_description: string;
  declaration_accepted: boolean;
  signature: string;
  counter_notice_at: string | null;
  counter_notice_text: string;
  owner_notified_at: string | null;
  counter_notice_days: number;
  items_detail: {
    id: string;
    outcome: "pending" | "removed" | "not_removed" | "restored";
    outcome_label: string;
    outcome_reason: string;
    case: { id: string; title: string; target_kind: TargetKind; status: CaseStatus; decision: Decision; legal_hold: boolean; restorable: boolean };
  }[];
}

export interface ComplianceReport {
  year: number;
  frozen: boolean;
  registered_users: number;
  harmful_by_rule: Record<string, number>;
  safety_statement: string;
  items: { key: string; label: string; value: number | string; definition: string }[];
  years: number[];
}

/** Short summary of a moderation case on 07/09's admin detail pages ("Reports: open the case"). */
export interface CaseSummary {
  id: string;
  status: CaseStatus;
  priority: Priority;
  decision: Decision;
  rule: string;
  open_reports: number;
  reports: number;
}
