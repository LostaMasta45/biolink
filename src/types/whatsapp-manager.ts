export type TemplateType =
  | "text"
  | "image"
  | "video"
  | "document"
  | "reply_button"
  | "url_button"
  | "list";

export type ActivityStatus = "success" | "failed" | "pending";
export type WebhookStatus = "success" | "failed" | "retry";
export type WebhookDirection = "incoming" | "outgoing";

export interface TemplateButton {
  id: string;
  label: string;
  url?: string;
}

export interface TemplateRow {
  id: string;
  title: string;
  description?: string;
}

export interface TemplateSection {
  title: string;
  rows: TemplateRow[];
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  type: TemplateType;
  header: string | null;
  body: string;
  footer: string | null;
  media_url: string | null;
  buttons: TemplateButton[];
  sections: TemplateSection[];
  is_active: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger_type: string;
  condition_config: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  template_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
}

export interface CustomerFlow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  name: string;
  description: string | null;
  position: number;
  template_id: string | null;
  automation_id: string | null;
  next_node_id: string | null;
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
  automation?: Pick<AutomationRule, "id" | "name"> | null;
}

export interface AutoReplyRule {
  id: string;
  keyword: string;
  template_id: string;
  flow_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
  flow?: Pick<CustomerFlow, "id" | "name"> | null;
}

export interface ActivityLog {
  id: string;
  customer: string;
  event_type: string;
  automation_id: string | null;
  template_id: string | null;
  status: ActivityStatus;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  automation?: Pick<AutomationRule, "id" | "name"> | null;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
}

export interface WebhookLog {
  id: string;
  direction: WebhookDirection;
  event_type: string;
  status: WebhookStatus;
  latency_ms: number;
  retry_count: number;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WhatsAppSettings {
  id: boolean;
  api_key: string | null;
  admin_phone_id: string | null;
  admin_phone_number: string | null;
  bot_phone_id: string | null;
  bot_phone_number: string | null;
  webhook_url: string | null;
  timezone: string;
  retry_count: number;
  default_delay: number;
  debug_mode: boolean;
  updated_at: string;
}

export interface OverviewMetrics {
  apiStatus: "connected" | "disconnected" | "unchecked";
  webhookStatus: "healthy" | "degraded" | "inactive";
  totalAutomation: number;
  totalTemplates: number;
  totalFlows: number;
  triggersToday: number;
  successRate: number;
  lastWebhookAt: string | null;
}

export interface ApiResult<T> {
  data: T;
  message?: string;
}

