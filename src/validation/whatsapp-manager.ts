import { z } from "zod";

const optionalText = z.string().trim().nullable().optional();

export const templateButtonSchema = z.object({
  id: z.string().trim().min(1).max(256),
  label: z.string().trim().min(1, "Label tombol wajib diisi").max(20, "Label maksimal 20 karakter"),
  url: z.string().url("URL tombol tidak valid").optional().or(z.literal("")),
});

export const templateSectionSchema = z.object({
  title: z.string().trim().max(24),
  rows: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(24),
    description: z.string().trim().max(72).optional(),
  })).min(1),
});

export const carouselCardSchema = z.object({
  id: z.string().trim().min(1),
  header_type: z.enum(["image", "video"]),
  media_url: z.string().url("URL media card tidak valid"),
  body: z.string().trim().max(160, "Isi card maksimal 160 karakter").optional().or(z.literal("")),
  action_type: z.enum(["cta_url", "quick_reply"]),
  button_id: z.string().trim().min(1).max(256),
  button_label: z.string().trim().min(1).max(20),
  button_url: z.string().url("URL tombol card tidak valid").optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.action_type === "cta_url" && !value.button_url) {
    context.addIssue({ code: "custom", path: ["button_url"], message: "URL wajib untuk CTA card" });
  }
});

export const templateSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  category: z.string().trim().min(2, "Kategori wajib diisi").max(60),
  type: z.enum(["text", "image", "video", "audio", "document", "reply_button", "url_button", "list", "carousel"]),
  header_type: z.enum(["none", "text", "image", "video", "document"]),
  header: z.string().trim().max(60, "Header maksimal 60 karakter").nullable().optional(),
  body: z.string().trim().max(4096),
  footer: z.string().trim().max(60, "Footer maksimal 60 karakter").nullable().optional(),
  media_url: z.string().url("URL media tidak valid").nullable().optional().or(z.literal("")),
  preview_url: z.boolean(),
  filename: z.string().trim().max(255).nullable().optional(),
  list_button_text: z.string().trim().max(20),
  buttons: z.array(templateButtonSchema).max(3),
  sections: z.array(templateSectionSchema).max(10),
  carousel_cards: z.array(carouselCardSchema).max(10),
  usage_context: optionalText,
  is_active: z.boolean(),
}).superRefine((value, context) => {
  const interactive = ["reply_button", "url_button", "list"].includes(value.type);
  if (["text", "reply_button", "url_button", "list", "carousel"].includes(value.type) && !value.body) {
    context.addIssue({ code: "custom", path: ["body"], message: "Isi pesan wajib diisi" });
  }
  if (interactive && value.body.length > 1024) {
    context.addIssue({ code: "custom", path: ["body"], message: "Isi pesan interaktif maksimal 1024 karakter" });
  }
  if (["image", "video", "document"].includes(value.type) && value.body.length > 1024) {
    context.addIssue({ code: "custom", path: ["body"], message: "Caption maksimal 1024 karakter" });
  }
  if (["image", "video", "audio", "document"].includes(value.type) && !value.media_url) {
    context.addIssue({ code: "custom", path: ["media_url"], message: "URL media wajib diisi" });
  }
  if (["reply_button", "url_button"].includes(value.type) && ["image", "video", "document"].includes(value.header_type) && !value.media_url) {
    context.addIssue({ code: "custom", path: ["media_url"], message: "URL media header wajib diisi" });
  }
  if (value.header_type === "text" && !value.header) {
    context.addIssue({ code: "custom", path: ["header"], message: "Teks header wajib diisi" });
  }
  if (value.type === "list" && !["none", "text"].includes(value.header_type)) {
    context.addIssue({ code: "custom", path: ["header_type"], message: "List hanya mendukung header teks" });
  }
  if (["reply_button", "url_button"].includes(value.type) && value.buttons.length === 0) {
    context.addIssue({ code: "custom", path: ["buttons"], message: "Minimal satu tombol diperlukan" });
  }
  if (value.type === "url_button" && value.buttons.length !== 1) {
    context.addIssue({ code: "custom", path: ["buttons"], message: "CTA URL membutuhkan tepat satu tombol" });
  }
  if (value.type === "list" && value.sections.length === 0) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Minimal satu section diperlukan" });
  }
  if (value.type === "list" && !value.list_button_text) {
    context.addIssue({ code: "custom", path: ["list_button_text"], message: "Label tombol list wajib diisi" });
  }
  if (value.type === "carousel" && (value.carousel_cards.length < 2 || value.carousel_cards.length > 10)) {
    context.addIssue({ code: "custom", path: ["carousel_cards"], message: "Carousel membutuhkan 2-10 card" });
  }
});

export const automationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone_id: z.string().nullable().optional(),
  trigger_type: z.string().trim().min(1),
  condition_field: z.string().trim().min(1),
  condition_operator: z.string().trim().min(1),
  condition_value: z.string().trim().min(1),
  action_type: z.string().trim().min(1),
  action_config_value: z.string().trim().optional(),
  template_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean(),
}).superRefine((value, context) => {
  if (["Kirim template", "Kirim quick reply"].includes(value.action_type) && !value.template_id) {
    context.addIssue({ code: "custom", path: ["template_id"], message: "Template wajib dipilih" });
  }
});

export const flowSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: optionalText,
  is_active: z.boolean(),
});

export const flowNodeSchema = z.object({
  flow_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: optionalText,
  position: z.number().int().nonnegative(),
  template_id: z.string().uuid().nullable().optional(),
  automation_id: z.string().uuid().nullable().optional(),
  next_node_id: z.string().uuid().nullable().optional(),
});

export const autoReplySchema = z.object({
  keyword: z.string().trim().min(1, "Keyword wajib diisi").max(100, "Keyword maksimal 100 karakter"),
  template_id: z.string().uuid({ message: "Template wajib dipilih" }),
  match_type: z.enum(["equals", "contains", "starts_with"]),
  delay_seconds: z.number().int().min(0).max(30),
  cooldown_seconds: z.number().int().min(0).max(86400),
  priority: z.number().int().min(-1000).max(1000),
  schedule_mode: z.enum(["always", "business_hours", "outside_hours"]),
  handover_to_human: z.boolean(),
  handover_duration_minutes: z.number().int().min(1).max(10080),
  is_test_mode: z.boolean(),
  test_phone_numbers: z.array(z.string().trim().regex(/^\d{8,16}$/, "Nomor test harus berupa 8-16 digit")).max(20),
  is_active: z.boolean(),
});

export const settingsSchema = z.object({
  api_key: z.string().trim().max(500).nullable().optional(),
  admin_phone_id: z.string().trim().max(100).nullable().optional(),
  admin_phone_number: z.string().trim().max(30).nullable().optional(),
  bot_phone_id: z.string().trim().max(100).nullable().optional(),
  bot_phone_number: z.string().trim().max(30).nullable().optional(),
  webhook_url: z.string().url("Webhook URL tidak valid").nullable().optional().or(z.literal("")),
  timezone: z.string().trim().min(1),
  retry_count: z.number().int().min(0).max(10),
  default_delay: z.number().int().min(0).max(86400),
  debug_mode: z.boolean(),
  business_hours_enabled: z.boolean(),
  business_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  business_hours_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  business_days: z.array(z.number().int().min(0).max(6)).min(1),
  auto_mark_read: z.boolean(),
  show_typing_indicator: z.boolean(),
});

export const resourceSchema = z.enum([
  "templates",
  "automation",
  "flows",
  "flow_nodes",
  "auto_reply",
  "logs",
  "webhook_logs",
  "settings",
]);

export type TemplateFormValues = z.input<typeof templateSchema>;
export type AutomationFormValues = z.input<typeof automationSchema>;
export type FlowFormValues = z.input<typeof flowSchema>;
export type AutoReplyFormValues = z.input<typeof autoReplySchema>;
export type SettingsFormValues = z.input<typeof settingsSchema>;
