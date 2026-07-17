export type TemplateType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "reply_button"
  | "url_button"
  | "list"
  | "carousel";

export type ActivityStatus = "success" | "failed" | "pending" | "skipped";
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

export type InteractiveHeaderType = "none" | "text" | "image" | "video" | "document";

export interface CarouselCard {
  id: string;
  header_type: "image" | "video";
  media_url: string;
  body?: string;
  action_type: "cta_url" | "quick_reply";
  button_id: string;
  button_label: string;
  button_url?: string;
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
  header_type: InteractiveHeaderType;
  preview_url: boolean;
  filename: string | null;
  list_button_text: string;
  buttons: TemplateButton[];
  sections: TemplateSection[];
  carousel_cards: CarouselCard[];
  is_active: boolean;
  usage_context?: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationRecipientType = "customer" | "admin" | "bot" | "custom";
export type WhatsAppSenderRole = "admin" | "bot";

export interface NotificationRule {
  id: string;
  event_key: string;
  name: string;
  description: string | null;
  recipient_type: NotificationRecipientType;
  custom_recipient: string | null;
  sender_role: WhatsAppSenderRole;
  template_id: string | null;
  is_active: boolean;
  delay_seconds: number;
  max_attempts: number;
  dedupe_window_seconds: number;
  variable_defaults: Record<string, string>;
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name" | "type"> | null;
}

export interface BotCommandConfig {
  id: string;
  command: string;
  aliases: string[];
  category: string;
  description: string;
  usage: string;
  handler_key: string;
  is_active: boolean;
  show_in_menu: boolean;
  admin_only: true;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  phone_id: string | null;
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
  execution_mode: "send_and_wait" | "send_and_continue" | "wait_for_reply" | "complete";
  delay_seconds: number;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
  automation?: Pick<AutomationRule, "id" | "name"> | null;
}

export type FlowTriggerType = "message_received" | "chat_started" | "conversation_closed" | "conversation_assigned" | "label_added" | "window_expiring" | "chat_inactive";

export interface FlowTrigger {
  id: string;
  flow_id: string;
  trigger_type: FlowTriggerType;
  name: string;
  config: Record<string, string | number | boolean>;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutoReplyRule {
  id: string;
  keyword: string;
  phone_id: string | null;
  template_id: string;
  flow_id: string | null;
  is_active: boolean;
  match_type: "equals" | "contains" | "starts_with";
  delay_seconds: number;
  cooldown_seconds: number;
  priority: number;
  schedule_mode: "always" | "business_hours" | "outside_hours";
  handover_to_human: boolean;
  handover_duration_minutes: number;
  is_test_mode: boolean;
  test_phone_numbers: string[];
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
  flow?: Pick<CustomerFlow, "id" | "name"> | null;
}

export interface FlowRun {
  id: string;
  flow_id: string;
  customer: string;
  sender_phone_id: string;
  trigger_rule_id: string | null;
  trigger_id: string | null;
  entry_event_id: string | null;
  current_node_id: string | null;
  status: "active" | "waiting" | "completed" | "failed" | "cancelled";
  context: Record<string, unknown>;
  last_error: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  flow?: Pick<CustomerFlow, "id" | "name"> | null;
  current_node?: Pick<FlowNode, "id" | "name"> | null;
}

export interface FlowRunStep {
  id: string;
  run_id: string;
  node_id: string | null;
  sequence: number;
  status: "running" | "waiting" | "pending_delivery" | "delivered" | "read" | "completed" | "failed" | "skipped";
  input_text: string | null;
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  node?: Pick<FlowNode, "id" | "name"> | null;
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
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  auto_mark_read: boolean;
  show_typing_indicator: boolean;
  updated_at: string;
}

export interface OverviewMetrics {
  apiStatus: "connected" | "disconnected" | "unchecked";
  webhookStatus: "healthy" | "degraded" | "inactive";
  totalAutoReply: number;
  totalTemplates: number;
  totalFlows: number;
  triggersToday: number;
  successRate: number;
  lastWebhookAt: string | null;
  activeAutoReply: number;
  queuedJobs: number;
  failedJobsToday: number;
  apiMessagesToday: number;
  webhookEventsToday: number;
  skippedToday: number;
  activeHandovers: number;
  activeNotificationRules: number;
  notificationQueue: number;
  notificationFailedToday: number;
  activeBotCommands: number;
}

export interface ApiResult<T> {
  data: T;
  message?: string;
}
