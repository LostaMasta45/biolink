import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_FLOW_NODES } from "@/constants/whatsapp-manager";
import {
  autoReplySchema,
  automationSchema,
  flowNodeSchema,
  flowSchema,
  resourceSchema,
  settingsSchema,
  templateSchema,
} from "@/validation/whatsapp-manager";
import type { OverviewMetrics } from "@/types/whatsapp-manager";

export type ManagerResource = ReturnType<typeof resourceSchema.parse>;

const SELECTS: Record<ManagerResource, string> = {
  templates: "*",
  automation: "*, template:templates(id,name)",
  flows: "*",
  flow_nodes: "*, template:templates(id,name), automation:automation(id,name)",
  auto_reply: "*, template:templates(id,name), flow:flows(id,name)",
  logs: "*, automation:automation(id,name), template:templates(id,name)",
  webhook_logs: "*",
  settings: "*",
};

const ORDER_COLUMNS: Record<ManagerResource, string> = {
  templates: "updated_at",
  automation: "updated_at",
  flows: "updated_at",
  flow_nodes: "position",
  auto_reply: "keyword",
  logs: "created_at",
  webhook_logs: "created_at",
  settings: "updated_at",
};

const ASCENDING_RESOURCES = new Set<ManagerResource>(["flow_nodes", "auto_reply"]);

function maskSettings(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const settings = row as Record<string, unknown>;
    const apiKey = typeof settings.api_key === "string" ? settings.api_key : "";
    return { ...settings, api_key: apiKey ? `••••••••${apiKey.slice(-4)}` : null };
  });
}

export async function listResource(
  supabase: SupabaseClient,
  resourceInput: string,
  filters: URLSearchParams,
): Promise<unknown[]> {
  const resource = resourceSchema.parse(resourceInput);
  const flowId = filters.get("flow_id");
  if (flowId === "none" && resource === "flow_nodes") return [];

  let query = supabase
    .from(resource)
    .select(SELECTS[resource])
    .order(ORDER_COLUMNS[resource], { ascending: ASCENDING_RESOURCES.has(resource) });
  const status = filters.get("status");
  const automationId = filters.get("automation_id");
  const customer = filters.get("customer");
  const from = filters.get("from");
  const to = filters.get("to");

  if (flowId && resource === "flow_nodes") query = query.eq("flow_id", flowId);
  if (status && (resource === "logs" || resource === "webhook_logs")) query = query.eq("status", status);
  if (automationId && resource === "logs") query = query.eq("automation_id", automationId);
  if (customer && resource === "logs") query = query.ilike("customer", `%${customer}%`);
  if (from && (resource === "logs" || resource === "webhook_logs")) query = query.gte("created_at", from);
  if (to && (resource === "logs" || resource === "webhook_logs")) query = query.lte("created_at", to);
  if (resource === "logs" || resource === "webhook_logs") query = query.limit(250);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown[];
  return resource === "settings" ? maskSettings(rows) : rows;
}

function parsePayload(resource: ManagerResource, payload: unknown): Record<string, unknown> {
  switch (resource) {
    case "templates":
      return templateSchema.parse(payload);
    case "automation": {
      const parsed = automationSchema.parse(payload);
      return {
        name: parsed.name,
        phone_id: parsed.phone_id ?? null,
        trigger_type: parsed.trigger_type,
        condition_config: {
          field: parsed.condition_field,
          operator: parsed.condition_operator,
          value: parsed.condition_value,
        },
        action_type: parsed.action_type,
        action_config: { value: parsed.action_config_value ?? "" },
        template_id: parsed.template_id ?? null,
        is_active: parsed.is_active,
      };
    }
    case "flows":
      return flowSchema.parse(payload);
    case "flow_nodes":
      return flowNodeSchema.parse(payload);
    case "auto_reply":
      return autoReplySchema.parse(payload);
    case "settings":
      return settingsSchema.parse(payload);
    case "logs":
    case "webhook_logs":
      throw new Error(`${resource} bersifat read-only dari dashboard`);
  }
}

function cleanMaskedApiKey(payload: Record<string, unknown>): Record<string, unknown> {
  if (typeof payload.api_key === "string" && payload.api_key.startsWith("••••")) {
    const cleaned = { ...payload };
    delete cleaned.api_key;
    return cleaned;
  }
  return payload;
}

export async function createResource(
  supabase: SupabaseClient,
  resourceInput: string,
  input: unknown,
): Promise<unknown> {
  const resource = resourceSchema.parse(resourceInput);
  const payload = parsePayload(resource, input);
  const { data, error } = await supabase.from(resource).insert(payload).select("*").single();
  if (error) throw new Error(error.message);

  if (resource === "flows" && data && typeof data === "object" && "id" in data) {
    const flowId = String(data.id);
    const nodes = DEFAULT_FLOW_NODES.map((name, position) => ({
      flow_id: flowId,
      name,
      description: `Tahap ${name} pada customer journey`,
      position,
    }));
    const { data: createdNodes, error: nodesError } = await supabase
      .from("flow_nodes")
      .insert(nodes)
      .select("id, position")
      .order("position", { ascending: true });
    if (nodesError) throw new Error(`Flow tersimpan, tetapi node default gagal dibuat: ${nodesError.message}`);
    const orderedNodes = (createdNodes ?? []) as Array<{ id: string; position: number }>;
    await Promise.all(orderedNodes.slice(0, -1).map((node, index) =>
      supabase.from("flow_nodes").update({ next_node_id: orderedNodes[index + 1]?.id ?? null }).eq("id", node.id)
    ));
  }

  return data;
}

export async function updateResource(
  supabase: SupabaseClient,
  resourceInput: string,
  id: string,
  input: unknown,
): Promise<unknown> {
  const resource = resourceSchema.parse(resourceInput);
  if (resource === "logs" || resource === "webhook_logs") {
    throw new Error(`${resource} bersifat read-only dari dashboard`);
  }
  const parsed = parsePayload(resource, input);
  const payload = resource === "settings" ? cleanMaskedApiKey(parsed) : parsed;
  const value: string | boolean = resource === "settings" ? true : id;
  const { data, error } = await supabase.from(resource).update(payload).eq("id", value).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteResource(
  supabase: SupabaseClient,
  resourceInput: string,
  id: string,
): Promise<void> {
  const resource = resourceSchema.parse(resourceInput);
  if (resource === "logs" || resource === "webhook_logs" || resource === "settings") {
    throw new Error(`${resource} tidak dapat dihapus dari dashboard`);
  }
  const { error } = await supabase.from(resource).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function exactCount(supabase: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getOverviewMetrics(supabase: SupabaseClient): Promise<OverviewMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalAutomation, totalTemplates, totalFlows, triggerResult, successResult, webhookResult] = await Promise.all([
    exactCount(supabase, "automation"),
    exactCount(supabase, "templates"),
    exactCount(supabase, "flows"),
    supabase.from("logs").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase.from("logs").select("status").gte("created_at", today.toISOString()),
    supabase.from("webhook_logs").select("status, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  if (triggerResult.error) throw new Error(triggerResult.error.message);
  if (successResult.error) throw new Error(successResult.error.message);
  if (webhookResult.error) throw new Error(webhookResult.error.message);

  const statuses = (successResult.data ?? []) as Array<{ status: string }>;
  const successCount = statuses.filter((item) => item.status === "success").length;
  const webhooks = (webhookResult.data ?? []) as Array<{ status: string; created_at: string }>;
  const recentFailures = webhooks.slice(0, 10).filter((item) => item.status === "failed").length;

  return {
    apiStatus: "unchecked",
    webhookStatus: webhooks.length === 0 ? "inactive" : recentFailures >= 3 ? "degraded" : "healthy",
    totalAutomation,
    totalTemplates,
    totalFlows,
    triggersToday: triggerResult.count ?? 0,
    successRate: statuses.length ? Math.round((successCount / statuses.length) * 100) : 0,
    lastWebhookAt: webhooks[0]?.created_at ?? null,
  };
}
