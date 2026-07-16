import { z } from "zod";

const optionalText = z.string().trim().nullable().optional();

export const templateButtonSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1, "Label tombol wajib diisi").max(25),
  url: z.string().url("URL tombol tidak valid").optional().or(z.literal("")),
});

export const templateSectionSchema = z.object({
  title: z.string().trim().min(1).max(60),
  rows: z.array(z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1).max(40),
    description: z.string().trim().max(72).optional(),
  })).min(1).max(10),
});

export const templateSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  category: z.string().trim().min(2, "Kategori wajib diisi").max(60),
  type: z.enum(["text", "image", "video", "document", "reply_button", "url_button", "list", "carousel"]),
  header: optionalText,
  body: z.string().trim().min(1, "Isi pesan wajib diisi").max(4096),
  footer: optionalText,
  media_url: z.string().url("URL media tidak valid").nullable().optional().or(z.literal("")),
  buttons: z.array(templateButtonSchema).max(3),
  sections: z.array(templateSectionSchema).max(10),
  usage_context: optionalText,
  is_active: z.boolean(),
}).superRefine((value, context) => {
  if (["image", "video", "document"].includes(value.type) && !value.media_url) {
    context.addIssue({ code: "custom", path: ["media_url"], message: "URL media wajib diisi" });
  }
  if (["reply_button", "url_button"].includes(value.type) && value.buttons.length === 0) {
    context.addIssue({ code: "custom", path: ["buttons"], message: "Minimal satu tombol diperlukan" });
  }
  if (value.type === "list" && value.sections.length === 0) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Minimal satu section diperlukan" });
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
