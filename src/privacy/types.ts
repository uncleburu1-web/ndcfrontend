/** Spec 14 — privacy and security shapes, as the API returns them. */
export type Purpose = "political_following" | "membership" | "pvc_check" | "verified_badge";

export interface ConsentPurpose {
  key: Purpose;
  label: string;
  version: number;
  text: string;
  withdraw_effect: string;
  material_since: number;
  notice_anchor: string;
}

export interface NoticeCategory {
  key: string;
  label: string;
  collected: string;
  purpose: string;
  lawful_basis: string;
  visible_to: string;
  retention: string;
  on_deletion: string;
  sensitive: boolean;
}

export interface PrivacyNotice {
  version: number;
  updated: string;
  draft: boolean;
  controller: string;
  contact: string;
  security_contact: string;
  categories: NoticeCategory[];
  consents: ConsentPurpose[];
  processors: { name: string; role: string; location: string; transfer_basis: string; data: string }[];
  rights: { key: string; title: string; how: string }[];
  changes: { date: string; text: string }[];
  request_days: number;
}

export interface ConsentState {
  purpose: Purpose;
  label: string;
  current_version: number;
  text: string;
  given: boolean;
  version: number | null;
  granted_at: string | null;
  method: "dialog" | "form" | "before_records" | null;
  needs_confirmation: boolean;
  outdated: boolean;
  withdraw_effect: string;
}

export type RequestStatus = "open" | "waiting" | "done" | "refused";

export interface RequestEvent {
  event: string;
  note: string;
  at: string;
  shown_to_person?: boolean;
  by?: string;
}

export interface PrivacyRequest {
  id: string;
  reference: string;
  kind: string;
  kind_label: string;
  details: string;
  status: RequestStatus;
  status_label: string;
  received_at: string;
  due_at: string;
  due_words: string;
  overdue: boolean;
  closed_at: string | null;
  outcome: string;
  self_served: boolean;
  events: RequestEvent[];
  person?: { id: string; name: string; email: string; deleted: boolean } | null;
  person_name?: string;
  assigned_to?: string;
  linked_actions?: { key: string; label: string }[];
}

export interface MyPrivacy {
  consents: ConsentState[];
  requests: PrivacyRequest[];
  downloads: string[];
  consent_history: { purpose: Purpose; label: string; version: number; granted_at: string; withdrawn_at: string | null; effect: string;
    method: string }[];
  security_notices: { id: string; reference: string; text: string; sent_at: string }[];
  request_kinds: { value: string; label: string }[];
  delete: { goes: string[]; stays: string[] };
  privacy_version: number;
}

export type ClockState = "due" | "overdue" | "done";

export interface Clock {
  key: "ndpc" | "ngcert" | "people";
  label: string;
  due_at: string;
  done_at: string | null;
  state: ClockState;
  words: string;
}

export type IncidentStatus = "open" | "contained" | "closed";
export type Risk = "none" | "low" | "high";

export interface Incident {
  id: string;
  reference: string;
  title: string;
  status: IncidentStatus;
  status_label: string;
  risk: Risk;
  risk_label: string;
  detected_at: string;
  aware_at: string;
  is_personal_data_breach: boolean;
  is_cyber_incident: boolean;
  clocks: Clock[];
  closed_at: string | null;
  description?: string;
  systems?: string;
  data_categories?: string[];
  people_affected_estimate?: number | null;
  processor?: string;
  ndpc_notified_at?: string | null;
  ndpc_reference?: string;
  ngcert_notified_at?: string | null;
  ngcert_reference?: string;
  people_notified_at?: string | null;
  notice_version?: number;
  notice_sent_version?: number;
  notice_text?: string;
  notice_sent_at?: string | null;
  can_send_notice?: boolean;
  root_cause?: string;
  lessons?: string;
  events?: { event: string; note: string; at: string; by: string }[];
}

export interface IncidentList {
  results: Incident[];
  counts: { open: number; closed: number };
  categories: { key: string; label: string }[];
  processors: { key: string; label: string }[];
}
