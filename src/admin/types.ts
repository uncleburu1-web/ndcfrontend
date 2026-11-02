/** Shapes from /admin/overview/, /admin/team/, /admin/users/ and /admin/audit/ (spec 11 §7). */
export type Severity = "ok" | "warning" | "error" | "info";

export interface AttentionCardData {
  key: string;
  label: string;
  count: number;
  href: string;
  oldest_at: string | null;
  target_hours: number | null;
  target_working_days: number | null;
  any_is_warning: boolean;
  severity: Severity;
}
export interface StatData {
  group: string;
  key: string;
  label: string;
  total: number;
  this_week: number | null;
  last_week: number | null;
  kobo: boolean;
}
export interface Blackout { offices: string[]; start: string; end: string; state: "active" | "upcoming" | "past" }
export interface ReadinessItem { group: string; label: string; state: "ready" | "not_set" | "warning" | "error" | "info"; ok: boolean; detail: string }
export interface JobRow {
  job: string;
  label: string;
  state: "never" | "running" | "ok" | "failed" | "overdue" | "stalled";
  state_label: string;
  manual: boolean;
  started_at: string | null;
  finished_at: string | null;
  summary: string;
  error: string;
}
export interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  action_label: string;
  actor: string;
  actor_id: string | null;
  target_type: string;
  target_label: string;
  target_id: string;
  link: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string;
}
export interface Overview {
  generated_at: string;
  roles: { role: string; label: string }[];
  attention: AttentionCardData[];
  stats: { group: string; label: string; stats: StatData[] }[];
  failed: { app: string; label: string }[];
  blackouts: { active: Blackout[]; next: Blackout | null };
  readiness?: { items: ReadinessItem[]; blackouts: Blackout[] };
  jobs?: JobRow[];
  activity?: AuditEntry[];
}
export interface Assignment {
  id: string;
  role: string;
  role_label: string;
  scope_type: string;
  scope_id: string | null;
  scope_label: string;
  user: { id: string; full_name: string; email: string; is_active: boolean };
  note: string;
  granted_by: string;
  granted_at: string;
  is_active: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  is_own: boolean;
}
export interface GrantableRole { role: string; label: string; description: string }
export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  joined_at: string;
  profile_complete: boolean;
  is_active: boolean;
  deleted: boolean;
  roles: { role: string; scope_type: string }[];
}
export interface UserDetail extends UserSummary {
  phone_masked: string;
  updated_at: string;
  deactivated_at: string | null;
  clerk_deleted_at: string | null;
  deactivation: { at: string; by: string; reason: string; clerk_ban: string } | null;
  assignments: Assignment[];
  recent_actions: AuditEntry[];
  is_self: boolean;
}

export const ROLE_LABELS: Record<string, string> = {
  system_admin: "System administrator",
  news_reviewer: "News reviewer",
  pvc_officer: "PVC officer",
  membership_officer: "Membership officer",
  finance_officer: "Finance officer",
  moderator: "Community moderator",
  candidate: "Candidate link",
};
