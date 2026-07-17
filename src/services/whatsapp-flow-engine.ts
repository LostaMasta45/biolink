import { sendMappedTemplate, type TemplateData } from "@/services/kirimdev-mapper";
import { whatsappAdminClient as supabase, writeActivityLog } from "@/services/whatsapp-audit-service";

type FlowExecutionMode = "send_and_wait" | "send_and_continue" | "wait_for_reply" | "complete";
type FlowRunStatus = "active" | "waiting" | "completed" | "failed" | "cancelled";

interface FlowNodeRow {
  id: string;
  flow_id: string;
  name: string;
  description: string | null;
  position: number;
  template_id: string | null;
  next_node_id: string | null;
  execution_mode: FlowExecutionMode;
  delay_seconds: number;
  template: TemplateData | null;
}

interface FlowRunRow {
  id: string;
  flow_id: string;
  customer: string;
  sender_phone_id: string;
  trigger_rule_id: string | null;
  trigger_id: string | null;
  entry_event_id: string | null;
  current_node_id: string | null;
  status: FlowRunStatus;
  context: Record<string, unknown>;
}

type FlowTriggerType = "message_received" | "chat_started" | "conversation_closed" | "conversation_assigned" | "label_added" | "window_expiring" | "chat_inactive";

interface FlowTriggerRow {
  id: string;
  flow_id: string;
  trigger_type: FlowTriggerType;
  name: string;
  config: Record<string, string | number | boolean>;
  priority: number;
  is_active: boolean;
  flow: { id: string; is_active: boolean } | null;
}

export type FlowExecutionResult =
  | { handled: false }
  | { handled: true; status: "waiting" | "completed"; runId: string; flowId: string; nodeId?: string }
  | { handled: true; status: "failed"; runId?: string; flowId?: string; error: string };

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits.startsWith("62") ? digits : `62${digits}`;
}

async function isInsideCustomerServiceWindow(customer: string): Promise<boolean> {
  const { data, error } = await supabase.from("whatsapp_contact_activity")
    .select("last_inbound_at")
    .eq("customer", customer)
    .maybeSingle();
  if (error) throw new Error(`Jendela layanan customer gagal dibaca: ${error.message}`);
  if (!data?.last_inbound_at) return false;
  return Date.now() - new Date(data.last_inbound_at).getTime() < 24 * 60 * 60_000;
}

function renderValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
      const replacement = variables[key];
      return replacement === null || replacement === undefined ? "" : String(replacement);
    });
  }
  if (Array.isArray(value)) return value.map((item) => renderValue(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderValue(item, variables)]));
  }
  return value;
}

function renderTemplate(template: TemplateData, context: Record<string, unknown>, customer: string): TemplateData {
  return renderValue(template, { ...context, customer_phone: customer }) as TemplateData;
}

async function writeFlowLog(input: {
  customer: string;
  eventType: string;
  status: "success" | "failed" | "pending" | "skipped";
  message: string;
  run?: FlowRunRow | null;
  node?: FlowNodeRow | null;
  metadata?: Record<string, unknown>;
}) {
  await writeActivityLog({
    customer: input.customer,
    eventType: input.eventType,
    status: input.status,
    message: input.message,
    templateId: input.node?.template_id ?? null,
    metadata: {
      flow_run_id: input.run?.id ?? null,
      flow_id: input.run?.flow_id ?? input.node?.flow_id ?? null,
      node_id: input.node?.id ?? null,
      node_name: input.node?.name ?? null,
      ...input.metadata,
    },
  });
}

async function getNode(nodeId: string): Promise<FlowNodeRow | null> {
  const { data, error } = await supabase
    .from("flow_nodes")
    .select("id,flow_id,name,description,position,template_id,next_node_id,execution_mode,delay_seconds,template:templates(*)")
    .eq("id", nodeId)
    .maybeSingle();
  if (error) throw new Error(`Node flow gagal dibaca: ${error.message}`);
  return data as unknown as FlowNodeRow | null;
}

async function getFirstNode(flowId: string): Promise<FlowNodeRow | null> {
  const { data, error } = await supabase
    .from("flow_nodes")
    .select("id,flow_id,name,description,position,template_id,next_node_id,execution_mode,delay_seconds,template:templates(*)")
    .eq("flow_id", flowId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Node awal flow gagal dibaca: ${error.message}`);
  return data as unknown as FlowNodeRow | null;
}

async function nextSequence(runId: string): Promise<number> {
  const { data, error } = await supabase
    .from("flow_run_steps")
    .select("sequence")
    .eq("run_id", runId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Riwayat flow gagal dibaca: ${error.message}`);
  return (data?.sequence ?? 0) + 1;
}

async function completeRun(run: FlowRunRow, node?: FlowNodeRow | null): Promise<FlowExecutionResult> {
  const { error } = await supabase.from("flow_runs").update({ status: "completed", current_node_id: null, completed_at: new Date().toISOString(), last_error: null }).eq("id", run.id);
  if (error) throw new Error(`Flow tidak dapat diselesaikan: ${error.message}`);
  await writeFlowLog({ customer: run.customer, eventType: "flow.completed", status: "success", message: "Flow selesai", run, node });
  return { handled: true, status: "completed", runId: run.id, flowId: run.flow_id, nodeId: node?.id };
}

async function failRun(run: FlowRunRow, errorMessage: string, node?: FlowNodeRow | null): Promise<FlowExecutionResult> {
  await supabase.from("flow_runs").update({ status: "failed", last_error: errorMessage, completed_at: new Date().toISOString() }).eq("id", run.id);
  await writeFlowLog({ customer: run.customer, eventType: "flow.failed", status: "failed", message: errorMessage, run, node });
  return { handled: true, status: "failed", runId: run.id, flowId: run.flow_id, error: errorMessage };
}

async function executeCurrentNode(run: FlowRunRow, hops = 0): Promise<FlowExecutionResult> {
  if (hops >= 25) return failRun(run, "Flow dihentikan: terdeteksi lebih dari 25 transisi otomatis (cek loop Next Step)");
  if (!run.current_node_id) return completeRun(run);
  const node = await getNode(run.current_node_id);
  if (!node || node.flow_id !== run.flow_id) return failRun(run, "Node aktif flow tidak tersedia");

  const sequence = await nextSequence(run.id);
  const { data: step, error: stepError } = await supabase.from("flow_run_steps").insert({
    run_id: run.id,
    node_id: node.id,
    sequence,
    status: "running",
  }).select("id").single();
  if (stepError || !step) return failRun(run, `Riwayat node gagal dibuat: ${stepError?.message ?? "unknown error"}`, node);

  await writeFlowLog({ customer: run.customer, eventType: "flow.node.running", status: "pending", message: `Menjalankan node "${node.name}"`, run, node, metadata: { step_id: step.id, sequence } });

  if (node.execution_mode === "complete") {
    await supabase.from("flow_run_steps").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", step.id);
    return completeRun(run, node);
  }

  if (node.execution_mode === "wait_for_reply") {
    await supabase.from("flow_run_steps").update({ status: "waiting", completed_at: new Date().toISOString() }).eq("id", step.id);
    const { error } = await supabase.from("flow_runs").update({ status: "waiting" }).eq("id", run.id);
    if (error) return failRun(run, `Flow tidak dapat menunggu balasan: ${error.message}`, node);
    await writeFlowLog({ customer: run.customer, eventType: "flow.node.waiting", status: "pending", message: `Menunggu balasan customer di node "${node.name}"`, run, node, metadata: { step_id: step.id } });
    return { handled: true, status: "waiting", runId: run.id, flowId: run.flow_id, nodeId: node.id };
  }

  if (!node.template || !(node.template as TemplateData).id) {
    await supabase.from("flow_run_steps").update({ status: "failed", error: "Template node tidak tersedia", completed_at: new Date().toISOString() }).eq("id", step.id);
    return failRun(run, `Node "${node.name}" membutuhkan Pesan Tersimpan aktif`, node);
  }

  if (!await isInsideCustomerServiceWindow(run.customer)) {
    const error = "outside_24h_window: Pesan free-form Flow Map hanya dapat dikirim dalam 24 jam setelah pesan terakhir customer";
    await supabase.from("flow_run_steps").update({ status: "failed", error, completed_at: new Date().toISOString() }).eq("id", step.id);
    return failRun(run, error, node);
  }

  if (node.delay_seconds > 0 && node.delay_seconds <= 5) {
    await new Promise((resolve) => setTimeout(resolve, node.delay_seconds * 1000));
  }
  if (node.delay_seconds > 5) {
    await supabase.from("flow_run_steps").update({ status: "failed", error: "Delay flow di atas 5 detik memerlukan worker terjadwal", completed_at: new Date().toISOString() }).eq("id", step.id);
    return failRun(run, "Delay node di atas 5 detik belum dapat dijalankan tanpa scheduler per menit", node);
  }

  const result = await sendMappedTemplate(
    run.sender_phone_id,
    run.customer,
    renderTemplate(node.template as TemplateData, run.context ?? {}, run.customer),
    { source: "flow_executor", correlationId: `${run.id}:${node.id}:${sequence}`, ruleId: run.trigger_rule_id ?? undefined, templateId: node.template_id ?? undefined },
  );
  if (!result.success) {
    await supabase.from("flow_run_steps").update({ status: "failed", error: result.error ?? "KirimDev menolak pesan", completed_at: new Date().toISOString() }).eq("id", step.id);
    return failRun(run, result.error ?? "KirimDev menolak pesan flow", node);
  }

  await supabase.from("flow_run_steps").update({ status: "pending_delivery", provider_message_id: result.messageId ?? null, completed_at: new Date().toISOString() }).eq("id", step.id);
  await writeFlowLog({ customer: run.customer, eventType: "flow.node.sent", status: "pending", message: `Node "${node.name}" diterima KirimDev; menunggu delivery`, run, node, metadata: { step_id: step.id, sequence, provider_message_id: result.messageId ?? null } });

  if (node.execution_mode === "send_and_continue") {
    if (!node.next_node_id) return completeRun(run, node);
    const { error } = await supabase.from("flow_runs").update({ status: "active", current_node_id: node.next_node_id }).eq("id", run.id);
    if (error) return failRun(run, `Transisi node gagal: ${error.message}`, node);
    return executeCurrentNode({ ...run, status: "active", current_node_id: node.next_node_id }, hops + 1);
  }

  const { error } = await supabase.from("flow_runs").update({ status: "waiting" }).eq("id", run.id);
  if (error) return failRun(run, `Flow tidak dapat menunggu balasan: ${error.message}`, node);
  await writeFlowLog({ customer: run.customer, eventType: "flow.node.waiting", status: "pending", message: `Menunggu balasan customer setelah node "${node.name}"`, run, node, metadata: { step_id: step.id } });
  return { handled: true, status: "waiting", runId: run.id, flowId: run.flow_id, nodeId: node.id };
}

export async function startFlow(input: { flowId: string; customerPhone: string; senderPhoneId: string; triggerRuleId?: string | null; triggerId?: string | null; eventId?: string | null; text?: string }): Promise<FlowExecutionResult> {
  const customer = normalizePhone(input.customerPhone);
  if (!customer) return { handled: true, status: "failed", error: "Nomor customer flow tidak valid" };
  try {
    const { data: flow, error: flowError } = await supabase.from("flows").select("id,is_active").eq("id", input.flowId).maybeSingle();
    if (flowError) throw new Error(flowError.message);
    if (!flow?.is_active) return { handled: true, status: "failed", flowId: input.flowId, error: "Flow tidak ditemukan atau nonaktif" };
    const firstNode = await getFirstNode(input.flowId);
    if (!firstNode) return { handled: true, status: "failed", flowId: input.flowId, error: "Flow belum memiliki node" };

    const { data: previousRuns, error: previousError } = await supabase.from("flow_runs")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), last_error: "Digantikan trigger flow baru" })
      .eq("flow_id", input.flowId).eq("customer", customer).in("status", ["active", "waiting"])
      .select("id");
    if (previousError) throw new Error(`Run flow lama gagal ditutup: ${previousError.message}`);

    const context = { customer_phone: customer, trigger_text: input.text ?? "", trigger_event_id: input.eventId ?? null };
    const { data, error } = await supabase.from("flow_runs").insert({
      flow_id: input.flowId,
      customer,
      sender_phone_id: input.senderPhoneId,
      trigger_rule_id: input.triggerRuleId ?? null,
      trigger_id: input.triggerId ?? null,
      entry_event_id: input.eventId ?? null,
      current_node_id: firstNode.id,
      status: "active",
      context,
    }).select("id,flow_id,customer,sender_phone_id,trigger_rule_id,trigger_id,entry_event_id,current_node_id,status,context").single();
    if (error || !data) throw new Error(`Run flow gagal dibuat: ${error?.message ?? "unknown error"}`);
    const run = data as unknown as FlowRunRow;
    await writeFlowLog({ customer, eventType: "flow.started", status: "pending", message: "Flow dimulai", run, node: firstNode, metadata: { trigger_rule_id: input.triggerRuleId ?? null, trigger_id: input.triggerId ?? null, event_id: input.eventId ?? null, replaced_runs: previousRuns?.length ?? 0 } });
    return executeCurrentNode(run);
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Flow gagal dimulai";
    await writeActivityLog({ customer, eventType: "flow.failed", status: "failed", message: error, metadata: { flow_id: input.flowId, trigger_rule_id: input.triggerRuleId ?? null } });
    return { handled: true, status: "failed", flowId: input.flowId, error };
  }
}

export async function continueActiveFlow(input: { customerPhone: string; text: string; eventId?: string | null }): Promise<FlowExecutionResult> {
  const customer = normalizePhone(input.customerPhone);
  if (!customer) return { handled: false };
  try {
    const { data, error } = await supabase.from("flow_runs")
      .select("id,flow_id,customer,sender_phone_id,trigger_rule_id,trigger_id,entry_event_id,current_node_id,status,context")
      .eq("customer", customer).eq("status", "waiting")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(`Run flow aktif gagal dibaca: ${error.message}`);
    if (!data) return { handled: false };
    const run = data as unknown as FlowRunRow;
    const node = run.current_node_id ? await getNode(run.current_node_id) : null;
    if (!node) return failRun(run, "Node flow yang menunggu tidak tersedia");

    const { data: latestStep } = await supabase.from("flow_run_steps")
      .select("id")
      .eq("run_id", run.id)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestStep?.id) await supabase.from("flow_run_steps").update({ input_text: input.text }).eq("id", latestStep.id);
    await writeFlowLog({ customer, eventType: "flow.customer_reply", status: "pending", message: `Balasan customer diterima untuk node "${node.name}"`, run, node, metadata: { input_text: input.text, event_id: input.eventId ?? null } });
    if (!node.next_node_id) return completeRun(run, node);
    const { error: updateError } = await supabase.from("flow_runs").update({
      status: "active",
      current_node_id: node.next_node_id,
      context: { ...(run.context ?? {}), last_customer_reply: input.text, last_reply_event_id: input.eventId ?? null },
    }).eq("id", run.id).eq("status", "waiting");
    if (updateError) return failRun(run, `Flow tidak dapat dilanjutkan: ${updateError.message}`, node);
    return executeCurrentNode({ ...run, status: "active", current_node_id: node.next_node_id, context: { ...(run.context ?? {}), last_customer_reply: input.text } });
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Flow aktif gagal dilanjutkan";
    await writeActivityLog({ customer, eventType: "flow.failed", status: "failed", message: error, metadata: { input_text: input.text, event_id: input.eventId ?? null } });
    return { handled: true, status: "failed", error };
  }
}

function toNumber(value: string | number | boolean | undefined, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function triggerMatches(trigger: FlowTriggerRow, input: { type: FlowTriggerType; text?: string; labels?: string[] }): boolean {
  if (trigger.trigger_type !== input.type) return false;
  const config = trigger.config ?? {};
  if (input.type === "message_received") {
    const mode = String(config.match_mode ?? "all");
    const keyword = String(config.keyword ?? "").trim().toLowerCase();
    const text = input.text?.trim().toLowerCase() ?? "";
    if (mode === "all") return true;
    if (!keyword || !text) return false;
    if (mode === "contains") return text.includes(keyword);
    if (mode === "starts_with") return text.startsWith(keyword);
    return text === keyword;
  }
  if (input.type === "label_added") {
    const label = String(config.label ?? "").trim().toLowerCase();
    return Boolean(label && input.labels?.some((item) => item.toLowerCase() === label));
  }
  return true;
}

async function claimTriggerFiring(trigger: FlowTriggerRow, customer: string, bucket: string): Promise<boolean> {
  const dedupeKey = `${trigger.id}:${customer}:${bucket}`;
  const { error } = await supabase.from("flow_trigger_firings").insert({ trigger_id: trigger.id, customer, dedupe_key: dedupeKey });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Deduplikasi trigger flow gagal: ${error.message}`);
}

export async function recordCustomerActivity(input: { customerPhone: string; senderPhoneId: string; eventId?: string | null; text?: string }): Promise<void> {
  const customer = normalizePhone(input.customerPhone);
  if (!customer) return;
  const { error } = await supabase.from("whatsapp_contact_activity").upsert({
    customer,
    sender_phone_id: input.senderPhoneId,
    last_inbound_at: new Date().toISOString(),
    last_inbound_event_id: input.eventId ?? null,
    last_inbound_text: input.text?.slice(0, 4000) ?? null,
  });
  if (error) throw new Error(`Aktivitas customer gagal disimpan: ${error.message}`);
}

export async function processFlowTriggers(input: { type: FlowTriggerType; customerPhone: string; senderPhoneId: string; eventId?: string | null; text?: string; labels?: string[] }): Promise<FlowExecutionResult> {
  const customer = normalizePhone(input.customerPhone);
  if (!customer) return { handled: false };
  try {
    const { data, error } = await supabase.from("flow_triggers")
      .select("id,flow_id,trigger_type,name,config,priority,is_active,flow:flows!inner(id,is_active)")
      .eq("trigger_type", input.type)
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (error) throw new Error(`Trigger flow gagal dibaca: ${error.message}`);
    const trigger = ((data ?? []) as unknown as FlowTriggerRow[]).find((candidate) => candidate.flow?.is_active && triggerMatches(candidate, input));
    if (!trigger) return { handled: false };

    const bucket = input.type === "message_received" || input.type === "label_added"
      ? input.eventId ?? `${Date.now()}`
      : `${input.type}:${Math.floor(Date.now() / 60_000)}`;
    if (!await claimTriggerFiring(trigger, customer, bucket)) {
      await writeActivityLog({ customer, eventType: "flow.trigger.skipped_duplicate", status: "skipped", message: `Trigger "${trigger.name}" duplikat diabaikan`, metadata: { flow_id: trigger.flow_id, trigger_id: trigger.id, event_id: input.eventId ?? null } });
      return { handled: true, status: "waiting", runId: "duplicate", flowId: trigger.flow_id };
    }
    const started = await startFlow({
      flowId: trigger.flow_id,
      customerPhone: customer,
      senderPhoneId: input.senderPhoneId,
      triggerId: trigger.id,
      eventId: input.eventId,
      text: input.text,
    });
    if (started.handled) await writeActivityLog({ customer, eventType: "flow.trigger.fired", status: started.status === "failed" ? "failed" : "pending", message: `Trigger "${trigger.name}" dijalankan`, metadata: { flow_id: trigger.flow_id, trigger_id: trigger.id, trigger_type: trigger.trigger_type, event_id: input.eventId ?? null } });
    return started;
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Trigger flow gagal dijalankan";
    await writeActivityLog({ customer, eventType: "flow.trigger.failed", status: "failed", message: error, metadata: { trigger_type: input.type, event_id: input.eventId ?? null } });
    return { handled: true, status: "failed", error };
  }
}

export async function processScheduledFlowTriggers(limit = 50): Promise<{ processed: number; started: number; failed: number }> {
  const { data: triggers, error } = await supabase.from("flow_triggers")
    .select("id,flow_id,trigger_type,name,config,priority,is_active,flow:flows!inner(id,is_active)")
    .in("trigger_type", ["chat_inactive", "window_expiring"])
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (error) throw new Error(`Trigger terjadwal gagal dibaca: ${error.message}`);
  let processed = 0;
  let started = 0;
  let failed = 0;
  for (const trigger of (triggers ?? []) as unknown as FlowTriggerRow[]) {
    if (!trigger.flow?.is_active) continue;
    const minutes = Math.max(5, toNumber(trigger.config[trigger.trigger_type === "chat_inactive" ? "inactive_minutes" : "lead_minutes"], trigger.trigger_type === "chat_inactive" ? 1440 : 60));
    const now = Date.now();
    const from = trigger.trigger_type === "chat_inactive"
      ? new Date(now - minutes * 60_000).toISOString()
      : new Date(now - 24 * 60 * 60_000).toISOString();
    const to = trigger.trigger_type === "chat_inactive"
      ? from
      : new Date(now - (24 * 60 - minutes) * 60_000).toISOString();
    let query = supabase.from("whatsapp_contact_activity").select("customer,sender_phone_id,last_inbound_at").order("last_inbound_at", { ascending: true }).limit(limit);
    query = trigger.trigger_type === "chat_inactive" ? query.lte("last_inbound_at", to) : query.gte("last_inbound_at", from).lte("last_inbound_at", to);
    const { data: activities, error: activityError } = await query;
    if (activityError) throw new Error(`Aktivitas customer gagal dibaca: ${activityError.message}`);
    for (const activity of activities ?? []) {
      processed += 1;
      const bucket = `${trigger.trigger_type}:${Math.floor(now / Math.max(60_000, minutes * 60_000))}`;
      try {
        if (!await claimTriggerFiring(trigger, activity.customer, bucket)) continue;
        const result = await startFlow({ flowId: trigger.flow_id, customerPhone: activity.customer, senderPhoneId: activity.sender_phone_id, triggerId: trigger.id, text: "" });
        if (!result.handled || result.status === "failed") failed += 1;
        else started += 1;
      } catch (caught) {
        failed += 1;
        const message = caught instanceof Error ? caught.message : "Trigger terjadwal gagal";
        await writeActivityLog({ customer: activity.customer, eventType: "flow.trigger.failed", status: "failed", message, metadata: { trigger_id: trigger.id, trigger_type: trigger.trigger_type } });
      }
    }
  }
  return { processed, started, failed };
}

export async function simulateFlow(flowId: string): Promise<{ valid: boolean; errors: string[]; nodes: Array<{ id: string; name: string; executionMode: FlowExecutionMode; nextNodeId: string | null }> }> {
  const { data, error } = await supabase.from("flow_nodes")
    .select("id,name,position,execution_mode,next_node_id,template_id,delay_seconds")
    .eq("flow_id", flowId).order("position", { ascending: true });
  if (error) throw new Error(`Flow gagal divalidasi: ${error.message}`);
  const nodes = (data ?? []) as Array<{ id: string; name: string; position: number; execution_mode: FlowExecutionMode; next_node_id: string | null; template_id: string | null; delay_seconds: number }>;
  const errors: string[] = [];
  if (!nodes.length) errors.push("Flow belum memiliki node");
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (["send_and_wait", "send_and_continue"].includes(node.execution_mode) && !node.template_id) errors.push(`Node "${node.name}" memerlukan Pesan Tersimpan`);
    if (node.next_node_id && !ids.has(node.next_node_id)) errors.push(`Next Step node "${node.name}" tidak valid`);
    if (node.delay_seconds > 5) errors.push(`Node "${node.name}" memiliki delay di atas 5 detik dan membutuhkan scheduler per menit`);
  }
  const autoNodes = nodes.filter((node) => node.execution_mode === "send_and_continue");
  if (autoNodes.length > 25) errors.push("Terlalu banyak node otomatis; pecah flow agar aman");
  return { valid: errors.length === 0, errors, nodes: nodes.map((node) => ({ id: node.id, name: node.name, executionMode: node.execution_mode, nextNodeId: node.next_node_id })) };
}
