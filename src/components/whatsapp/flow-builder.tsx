"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, GripVertical, Link2, Play, Plus, Radio } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmation } from "@/components/whatsapp/delete-confirmation";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { createManagerResource, deleteManagerResource, runManagerAction, updateManagerResource } from "@/services/whatsapp-manager-client";
import type { AutoReplyRule, CustomerFlow, FlowNode, FlowRun, FlowRunStep, FlowTrigger, FlowTriggerType, WhatsAppTemplate } from "@/types/whatsapp-manager";
import { flowNodeSchema, flowSchema, flowTriggerSchema, type AutoReplyFormValues, type FlowFormValues, type FlowTriggerFormValues } from "@/validation/whatsapp-manager";

interface NodeFormValues {
  flow_id: string;
  name: string;
  description?: string | null;
  position: number;
  template_id?: string | null;
  automation_id?: string | null;
  next_node_id?: string | null;
  execution_mode: FlowNode["execution_mode"];
  delay_seconds: number;
  position_x: number;
  position_y: number;
}

type MessageTriggerSource = "auto_reply" | "all_messages";

const FLOW_DEFAULTS: FlowFormValues = { name: "Customer Journey", description: "Flow customer InfoLokerJombang", is_active: true };
const NODE_DEFAULTS: NodeFormValues = { flow_id: "", name: "", description: "", position: 0, template_id: null, automation_id: null, next_node_id: null, execution_mode: "send_and_wait", delay_seconds: 0, position_x: 360, position_y: 120 };
const TRIGGER_DEFAULTS: FlowTriggerFormValues = { flow_id: "", trigger_type: "message_received", name: "Semua pesan masuk", config: { match_mode: "all" }, priority: 0, is_active: true };

const TRIGGER_LABELS: Record<FlowTriggerType, string> = {
  message_received: "Saat pesan masuk",
  chat_started: "Saat chat baru dimulai",
  conversation_closed: "Saat chat diselesaikan",
  conversation_assigned: "Saat chat di-assign",
  label_added: "Saat label ditambahkan",
  window_expiring: "Saat jendela 24 jam hampir habis",
  chat_inactive: "Saat chat tidak aktif",
};

const MODE_LABELS: Record<FlowNode["execution_mode"], string> = {
  send_and_wait: "Kirim & tunggu balasan",
  send_and_continue: "Kirim & lanjut otomatis",
  wait_for_reply: "Tunggu balasan",
  complete: "Selesaikan flow",
};

const MATCH_LABELS: Record<AutoReplyRule["match_type"], string> = {
  equals: "Sama persis",
  starts_with: "Diawali",
  contains: "Mengandung",
};

function nodePayload(node: FlowNode, patch: Partial<NodeFormValues> = {}): NodeFormValues {
  return {
    flow_id: node.flow_id,
    name: node.name,
    description: node.description,
    position: node.position,
    template_id: node.template_id,
    automation_id: node.automation_id,
    next_node_id: node.next_node_id,
    execution_mode: node.execution_mode,
    delay_seconds: node.delay_seconds,
    position_x: node.position_x,
    position_y: node.position_y,
    ...patch,
  };
}

function autoReplyPayload(rule: AutoReplyRule, patch: Partial<AutoReplyFormValues> = {}): AutoReplyFormValues {
  return {
    keyword: rule.keyword,
    template_id: rule.template_id,
    flow_id: rule.flow_id,
    match_type: rule.match_type,
    delay_seconds: rule.delay_seconds,
    cooldown_seconds: rule.cooldown_seconds,
    priority: rule.priority,
    schedule_mode: rule.schedule_mode,
    handover_to_human: rule.handover_to_human,
    handover_duration_minutes: rule.handover_duration_minutes,
    is_test_mode: rule.is_test_mode,
    test_phone_numbers: rule.test_phone_numbers,
    is_active: rule.is_active,
    ...patch,
  };
}

function isCanvasTrigger(id: string) {
  return id.startsWith("trigger:") || id.startsWith("auto-reply:");
}

export function FlowBuilder() {
  const flows = useManagerResource<CustomerFlow>("flows");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const autoReplies = useManagerResource<AutoReplyRule>("auto_reply");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const activeFlowId = selectedFlowId || flows.data[0]?.id || "";
  const nodes = useManagerResource<FlowNode>("flow_nodes", activeFlowId ? `?flow_id=${activeFlowId}` : "?flow_id=none");
  const triggers = useManagerResource<FlowTrigger>("flow_triggers", activeFlowId ? `?flow_id=${activeFlowId}` : "?flow_id=none");
  const runs = useManagerResource<FlowRun>("flow_runs", activeFlowId ? `?flow_id=${activeFlowId}` : "?flow_id=none");
  const latestRun = runs.data[0];
  const steps = useManagerResource<FlowRunStep>("flow_run_steps", latestRun ? `?run_id=${latestRun.id}` : "?run_id=none");
  const [canvasNodes, setCanvasNodes, onNodesChange] = useNodesState<Node>([]);
  const [canvasEdges, setCanvasEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowDialog, setFlowDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [editingTrigger, setEditingTrigger] = useState<FlowTrigger | null>(null);
  const [editingAutoReplyTrigger, setEditingAutoReplyTrigger] = useState<AutoReplyRule | null>(null);
  const [triggerDialog, setTriggerDialog] = useState(false);
  const [messageTriggerSource, setMessageTriggerSource] = useState<MessageTriggerSource>("auto_reply");
  const [selectedAutoReplyId, setSelectedAutoReplyId] = useState("");
  const flowForm = useForm<FlowFormValues>({ resolver: zodResolver(flowSchema), defaultValues: FLOW_DEFAULTS });
  const nodeForm = useForm<NodeFormValues>({ resolver: zodResolver(flowNodeSchema), defaultValues: NODE_DEFAULTS });
  const triggerForm = useForm<FlowTriggerFormValues>({ resolver: zodResolver(flowTriggerSchema), defaultValues: TRIGGER_DEFAULTS });
  const executionMode = useWatch({ control: nodeForm.control, name: "execution_mode" });
  const templateId = useWatch({ control: nodeForm.control, name: "template_id" });
  const nextNodeId = useWatch({ control: nodeForm.control, name: "next_node_id" });
  const triggerType = useWatch({ control: triggerForm.control, name: "trigger_type" });
  const triggerConfig = useWatch({ control: triggerForm.control, name: "config" });
  const triggerActive = useWatch({ control: triggerForm.control, name: "is_active" });
  const selectedFlow = useMemo(() => flows.data.find((flow) => flow.id === activeFlowId), [activeFlowId, flows.data]);
  const linkedAutoReplies = useMemo(() => autoReplies.data.filter((rule) => rule.flow_id === activeFlowId), [activeFlowId, autoReplies.data]);
  const selectedAutoReply = useMemo(() => autoReplies.data.find((rule) => rule.id === selectedAutoReplyId) ?? null, [autoReplies.data, selectedAutoReplyId]);
  const hasActiveAllMessagesTrigger = useMemo(() => triggers.data.some((trigger) => trigger.is_active && trigger.trigger_type === "message_received" && trigger.config.match_mode === "all"), [triggers.data]);

  useEffect(() => {
    const firstNode = nodes.data[0];
    const autoReplyCanvasNodes: Node[] = linkedAutoReplies.map((rule, index) => ({
      id: `auto-reply:${rule.id}`,
      position: { x: 20, y: index * 130 + 60 },
      data: { label: `⚡ ${rule.keyword}\nAuto Reply · ${MATCH_LABELS[rule.match_type]}` },
      draggable: false,
      style: { width: 220, whiteSpace: "pre-line", border: "1px solid #22c55e", borderRadius: 12, background: "#052e16", color: "#dcfce7", padding: 12 },
    }));
    const directTriggerCanvasNodes: Node[] = triggers.data.map((trigger, index) => ({
      id: `trigger:${trigger.id}`,
      position: { x: 20, y: (linkedAutoReplies.length + index) * 130 + 60 },
      data: { label: `⚡ ${trigger.name}\n${TRIGGER_LABELS[trigger.trigger_type]}` },
      draggable: false,
      style: { width: 220, whiteSpace: "pre-line", border: "1px solid #0ea5e9", borderRadius: 12, background: "#082f49", color: "#e0f2fe", padding: 12 },
    }));
    const flowCanvasNodes: Node[] = nodes.data.map((node) => ({
      id: node.id,
      position: { x: node.position_x, y: node.position_y },
      data: { label: `${node.name}\n${MODE_LABELS[node.execution_mode]}${node.template?.name ? `\n${node.template.name}` : ""}` },
      style: { width: 250, whiteSpace: "pre-line", border: "1px solid #6366f1", borderRadius: 12, background: "#111827", color: "#f8fafc", padding: 12 },
    }));
    const transitionEdges: Edge[] = nodes.data.flatMap((node) => node.next_node_id ? [{ id: `edge:${node.id}:${node.next_node_id}`, source: node.id, target: node.next_node_id, label: "Next", animated: node.execution_mode === "send_and_continue" }] : []);
    const triggerEdges: Edge[] = firstNode ? [
      ...linkedAutoReplies.map((rule) => ({ id: `auto-reply-edge:${rule.id}`, source: `auto-reply:${rule.id}`, target: firstNode.id, label: "Mulai", style: { stroke: "#22c55e" }, labelStyle: { fill: "#16a34a" } })),
      ...triggers.data.map((trigger) => ({ id: `trigger-edge:${trigger.id}`, source: `trigger:${trigger.id}`, target: firstNode.id, label: "Mulai", style: { stroke: "#0ea5e9" }, labelStyle: { fill: "#0284c7" } })),
    ] : [];
    setCanvasNodes([...autoReplyCanvasNodes, ...directTriggerCanvasNodes, ...flowCanvasNodes]);
    setCanvasEdges([...triggerEdges, ...transitionEdges]);
  }, [linkedAutoReplies, nodes.data, setCanvasEdges, setCanvasNodes, triggers.data]);

  useEffect(() => {
    if (editingNode) nodeForm.reset(nodePayload(editingNode));
  }, [editingNode, nodeForm]);

  const openTrigger = (trigger: FlowTrigger | null) => {
    setEditingTrigger(trigger);
    setEditingAutoReplyTrigger(null);
    setMessageTriggerSource("all_messages");
    setSelectedAutoReplyId("");
    triggerForm.reset(trigger ? {
      flow_id: trigger.flow_id,
      trigger_type: trigger.trigger_type,
      name: trigger.name,
      config: trigger.config,
      priority: trigger.priority,
      is_active: trigger.is_active,
    } : { ...TRIGGER_DEFAULTS, flow_id: activeFlowId });
    setTriggerDialog(true);
  };

  const openAutoReplyTrigger = (rule: AutoReplyRule | null) => {
    setEditingTrigger(null);
    setEditingAutoReplyTrigger(rule);
    setMessageTriggerSource("auto_reply");
    setSelectedAutoReplyId(rule?.id ?? "");
    triggerForm.reset({ ...TRIGGER_DEFAULTS, flow_id: activeFlowId });
    setTriggerDialog(true);
  };

  const closeTriggerDialog = () => {
    setTriggerDialog(false);
    setEditingTrigger(null);
    setEditingAutoReplyTrigger(null);
  };

  const createFlow = flowForm.handleSubmit(async (values) => {
    try {
      const result = await createManagerResource<CustomerFlow>("flows", values);
      toast.success("Flow Map dibuat");
      setFlowDialog(false);
      await flows.refresh();
      setSelectedFlowId(result.data.id);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal membuat flow"); }
  });

  const saveNode = nodeForm.handleSubmit(async (values) => {
    if (!editingNode) return;
    try {
      await updateManagerResource<FlowNode>("flow_nodes", editingNode.id, values);
      toast.success("Node disimpan");
      setEditingNode(null);
      await nodes.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan node"); }
  });

  const saveTrigger = triggerForm.handleSubmit(async (values) => {
    try {
      if (triggerType === "message_received" && messageTriggerSource === "auto_reply") {
        if (!selectedAutoReply) throw new Error("Pilih satu Auto Reply terlebih dahulu");
        if (selectedAutoReply.is_active && hasActiveAllMessagesTrigger) throw new Error("Nonaktifkan trigger Semua pesan masuk terlebih dahulu agar flow tidak berjalan dua kali");
        if (editingAutoReplyTrigger && editingAutoReplyTrigger.id !== selectedAutoReply.id) {
          await updateManagerResource<AutoReplyRule>("auto_reply", editingAutoReplyTrigger.id, autoReplyPayload(editingAutoReplyTrigger, { flow_id: null }));
        }
        await updateManagerResource<AutoReplyRule>("auto_reply", selectedAutoReply.id, autoReplyPayload(selectedAutoReply, { flow_id: activeFlowId }));
        toast.success("Auto Reply terhubung sebagai trigger Flow");
        closeTriggerDialog();
        await autoReplies.refresh();
        return;
      }
      const directValues = { ...values, config: triggerType === "message_received" ? { match_mode: "all" } : values.config };
      if (triggerType === "message_received" && values.is_active && linkedAutoReplies.some((rule) => rule.is_active)) throw new Error("Flow ini sudah memakai Auto Reply aktif. Gunakan salah satu agar pesan tidak memulai dua run");
      if (editingTrigger) await updateManagerResource<FlowTrigger>("flow_triggers", editingTrigger.id, directValues);
      else await createManagerResource<FlowTrigger>("flow_triggers", directValues);
      toast.success("Trigger disimpan");
      closeTriggerDialog();
      await triggers.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan trigger"); }
  });

  const createNode = async () => {
    if (!activeFlowId) return;
    try {
      const maxPosition = Math.max(-1, ...nodes.data.map((node) => node.position));
      await createManagerResource<FlowNode>("flow_nodes", {
        ...NODE_DEFAULTS,
        flow_id: activeFlowId,
        name: `Node ${maxPosition + 2}`,
        position: maxPosition + 1,
        position_x: 620,
        position_y: Math.max(80, nodes.data.length * 130),
      });
      await nodes.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menambah node"); }
  };

  const removeNode = async () => {
    if (!editingNode) return;
    try {
      const incomingNodes = nodes.data.filter((node) => node.next_node_id === editingNode.id);
      await Promise.all(incomingNodes.map((node) => updateManagerResource<FlowNode>("flow_nodes", node.id, nodePayload(node, { next_node_id: editingNode.next_node_id }))));
      await deleteManagerResource("flow_nodes", editingNode.id);
      setEditingNode(null);
      await nodes.refresh();
      toast.success(incomingNodes.length ? "Node dihapus, koneksi sebelumnya dialihkan" : "Node dihapus");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus node"); }
  };

  const removeDirectTrigger = async () => {
    if (!editingTrigger) return;
    try {
      await deleteManagerResource("flow_triggers", editingTrigger.id);
      closeTriggerDialog();
      await triggers.refresh();
      toast.success("Trigger dihapus");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus trigger"); }
  };

  const unlinkAutoReplyTrigger = async () => {
    if (!editingAutoReplyTrigger) return;
    try {
      await updateManagerResource<AutoReplyRule>("auto_reply", editingAutoReplyTrigger.id, autoReplyPayload(editingAutoReplyTrigger, { flow_id: null }));
      closeTriggerDialog();
      await autoReplies.refresh();
      toast.success("Auto Reply dilepas dari Flow; rule tidak dihapus");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal melepas trigger"); }
  };

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target || isCanvasTrigger(connection.source) || isCanvasTrigger(connection.target)) return;
    const source = nodes.data.find((node) => node.id === connection.source);
    if (!source) return;
    try {
      await updateManagerResource<FlowNode>("flow_nodes", source.id, nodePayload(source, { next_node_id: connection.target }));
      setCanvasEdges((edges) => addEdge({ ...connection, label: "Next" }, edges));
      await nodes.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Koneksi node gagal disimpan"); }
  };

  const onNodeDragStop = async (_event: MouseEvent | TouchEvent, canvasNode: Node) => {
    if (isCanvasTrigger(canvasNode.id)) return;
    const source = nodes.data.find((node) => node.id === canvasNode.id);
    if (!source) return;
    try {
      await updateManagerResource<FlowNode>("flow_nodes", source.id, nodePayload(source, { position_x: Math.round(canvasNode.position.x), position_y: Math.round(canvasNode.position.y) }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Posisi node gagal disimpan"); }
  };

  const validateFlow = async () => {
    if (!activeFlowId) return;
    try {
      const result = await runManagerAction<{ valid: boolean; errors: string[] }>("simulate_flow", { flowId: activeFlowId });
      if (result.valid) toast.success("Flow valid dan siap dieksekusi");
      else toast.error(result.errors.join(" · "));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Validasi flow gagal"); }
  };

  const removeFlow = async () => {
    if (!selectedFlow) return;
    try {
      await deleteManagerResource("flows", selectedFlow.id);
      setSelectedFlowId("");
      await flows.refresh();
      await autoReplies.refresh();
      toast.success("Flow dihapus");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus flow"); }
  };

  if (flows.loading || templates.loading || autoReplies.loading) return <ResourceLoading />;
  if (flows.error || templates.error || autoReplies.error || nodes.error || triggers.error) return <ResourceError message={flows.error ?? templates.error ?? autoReplies.error ?? nodes.error ?? triggers.error ?? "Gagal memuat Flow Builder"} />;

  const triggerDialogTitle = editingAutoReplyTrigger ? "Atur trigger Auto Reply" : editingTrigger ? "Edit trigger" : "Trigger baru";

  return <div className="space-y-6">
    <PageHeading title="Flow Builder" description="Hubungkan Auto Reply sebagai pintu masuk, susun node dengan drag-and-drop, lalu pantau setiap eksekusi." icon={GitBranch} action={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!activeFlowId} onClick={validateFlow}><Play />Validasi</Button><Button onClick={() => { flowForm.reset(FLOW_DEFAULTS); setFlowDialog(true); }}><Plus />Flow</Button></div>} />
    {flows.data.length === 0 ? <EmptyState title="Belum ada Flow Map" description="Buat flow pertama, lalu hubungkan Auto Reply dan tambahkan node pada canvas." /> : <>
      <Card><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end"><div className="flex-1 space-y-2"><Label>Flow aktif</Label><Select value={activeFlowId} onValueChange={setSelectedFlowId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{flows.data.map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}</SelectContent></Select></div><Badge variant={selectedFlow?.is_active ? "default" : "secondary"}>{selectedFlow?.is_active ? "Aktif" : "Nonaktif"}</Badge><Button variant="outline" onClick={createNode}><Plus />Node</Button><Button variant="outline" onClick={() => openAutoReplyTrigger(null)}><Link2 />Hubungkan Auto Reply</Button><Button variant="outline" onClick={() => openTrigger(null)}><Radio />Trigger event</Button>{selectedFlow && <DeleteConfirmation label={selectedFlow.name} onConfirm={removeFlow} />}</CardContent></Card>
      <Card className="overflow-hidden"><CardContent className="p-0"><div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground"><GripVertical className="h-4 w-4" /> Geser node untuk menyimpan posisi. Tarik konektor dari node ke node tujuan untuk menetapkan Next Step. Klik node atau trigger untuk mengeditnya.</div><div className="h-[620px]"><ReactFlow nodes={canvasNodes} edges={canvasEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onNodeClick={(_event, canvasNode) => { if (canvasNode.id.startsWith("auto-reply:")) openAutoReplyTrigger(autoReplies.data.find((rule) => rule.id === canvasNode.id.slice(11)) ?? null); else if (canvasNode.id.startsWith("trigger:")) openTrigger(triggers.data.find((item) => item.id === canvasNode.id.slice(8)) ?? null); else setEditingNode(nodes.data.find((item) => item.id === canvasNode.id) ?? null); }} fitView><MiniMap pannable zoomable /><Controls /><Background gap={18} size={1} /></ReactFlow></div></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2"><Card><CardContent className="p-4"><p className="mb-1 font-semibold">Pintu masuk flow</p><p className="mb-3 text-xs text-muted-foreground">Hijau = Auto Reply berbasis keyword. Biru = event webhook atau scheduler.</p>{linkedAutoReplies.length || triggers.data.length ? <div className="space-y-2">{linkedAutoReplies.map((rule) => <button key={rule.id} type="button" onClick={() => openAutoReplyTrigger(rule)} className="flex w-full items-center justify-between rounded-lg border border-green-500/30 p-3 text-left hover:bg-muted/50"><span><b>{rule.keyword}</b><span className="block text-xs text-muted-foreground">Auto Reply · {MATCH_LABELS[rule.match_type]}</span></span><Badge variant={rule.is_active ? "default" : "secondary"}>{rule.is_active ? "Aktif" : "Nonaktif"}</Badge></button>)}{triggers.data.map((trigger) => <button key={trigger.id} type="button" onClick={() => openTrigger(trigger)} className="flex w-full items-center justify-between rounded-lg border border-sky-500/30 p-3 text-left hover:bg-muted/50"><span><b>{trigger.name}</b><span className="block text-xs text-muted-foreground">{TRIGGER_LABELS[trigger.trigger_type]}</span></span><Badge variant={trigger.is_active ? "default" : "secondary"}>{trigger.is_active ? "Aktif" : "Nonaktif"}</Badge></button>)}</div> : <p className="text-sm text-muted-foreground">Hubungkan Auto Reply untuk trigger keyword, atau pilih trigger event untuk menjalankan flow tanpa keyword.</p>}</CardContent></Card><Card><CardContent className="p-4"><p className="mb-3 font-semibold">Eksekusi terbaru</p>{latestRun ? <div className="space-y-2"><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">{latestRun.status}</Badge><span>{latestRun.customer}</span><span className="text-muted-foreground">{latestRun.current_node?.name ?? "Selesai"}</span></div>{steps.data.slice(-6).map((step) => <div key={step.id} className="flex justify-between rounded bg-muted/50 px-3 py-2 text-sm"><span>{step.sequence}. {step.node?.name ?? "Node"}</span><Badge variant="secondary">{step.status}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Belum ada run untuk flow ini.</p>}</CardContent></Card></div>
    </>}

    <Dialog open={flowDialog} onOpenChange={setFlowDialog}><DialogContent><DialogHeader><DialogTitle>Flow Map baru</DialogTitle><DialogDescription>Flow baru berisi node dasar yang dapat Anda susun ulang di canvas.</DialogDescription></DialogHeader><form onSubmit={createFlow} className="space-y-4"><div className="space-y-2"><Label>Nama</Label><Input {...flowForm.register("name")} /></div><div className="space-y-2"><Label>Deskripsi</Label><Textarea {...flowForm.register("description")} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFlowDialog(false)}>Batal</Button><Button type="submit">Buat Flow</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(editingNode)} onOpenChange={(open) => !open && setEditingNode(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit node</DialogTitle><DialogDescription>Pesan free-form hanya dipakai bila customer masih berada di jendela layanan WhatsApp 24 jam.</DialogDescription></DialogHeader><form onSubmit={saveNode} className="space-y-4"><div className="space-y-2"><Label>Nama</Label><Input {...nodeForm.register("name")} /></div><div className="space-y-2"><Label>Deskripsi</Label><Textarea {...nodeForm.register("description")} /></div><div className="space-y-2"><Label>Mode</Label><Select value={executionMode} onValueChange={(value: FlowNode["execution_mode"]) => nodeForm.setValue("execution_mode", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Pesan Tersimpan</Label><Select value={templateId ?? "none"} onValueChange={(value) => nodeForm.setValue("template_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa pesan</SelectItem>{templates.data.filter((template) => template.is_active).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Delay (detik)</Label><Input type="number" min={0} max={5} {...nodeForm.register("delay_seconds", { valueAsNumber: true })} /><p className="text-xs text-muted-foreground">Delay lebih dari 5 detik perlu scheduler per menit dan ditolak oleh validasi agar tidak tersangkut.</p></div><div className="space-y-2"><Label>Next Step</Label><Select value={nextNodeId ?? "none"} onValueChange={(value) => nodeForm.setValue("next_node_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Selesaikan flow</SelectItem>{nodes.data.filter((node) => node.id !== editingNode?.id).map((node) => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}</SelectContent></Select></div><div className="rounded-lg border border-destructive/30 p-3 text-xs text-muted-foreground">Menghapus node akan mengalihkan node yang sebelumnya menuju node ini ke Next Step node ini. Jika tidak ada Next Step, flow tersebut akan selesai.</div><DialogFooter className="gap-2 sm:justify-between"><DeleteConfirmation label={`node ${editingNode?.name ?? ""}`} onConfirm={removeNode} /><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setEditingNode(null)}>Batal</Button><Button type="submit">Simpan</Button></div></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={triggerDialog} onOpenChange={(open) => !open && closeTriggerDialog()}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{triggerDialogTitle}</DialogTitle><DialogDescription>{editingAutoReplyTrigger ? "Keyword, pencocokan, cooldown, jadwal, dan test mode dikelola sekali saja di Auto Reply." : "Gunakan event yang tersedia dari webhook KirimDev atau scheduler lokal untuk trigger waktu."}</DialogDescription></DialogHeader><form onSubmit={saveTrigger} className="space-y-4">{editingAutoReplyTrigger ? <><div className="space-y-2"><Label>Auto Reply yang memulai flow ini</Label><Select value={selectedAutoReplyId} onValueChange={setSelectedAutoReplyId}><SelectTrigger><SelectValue placeholder="Pilih Auto Reply" /></SelectTrigger><SelectContent>{autoReplies.data.map((rule) => <SelectItem key={rule.id} value={rule.id}>{rule.keyword} · {MATCH_LABELS[rule.match_type]}</SelectItem>)}</SelectContent></Select></div>{selectedAutoReply && <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm"><p className="font-medium">{selectedAutoReply.keyword}</p><p className="mt-1 text-xs text-muted-foreground">{MATCH_LABELS[selectedAutoReply.match_type]} · cooldown {selectedAutoReply.cooldown_seconds} dtk · {selectedAutoReply.is_active ? "aktif" : "nonaktif"}</p></div>}<p className="text-xs text-muted-foreground">Perubahan di sini hanya mengganti sambungan Flow. Untuk mengubah keyword atau aturannya, buka halaman Auto Reply.</p><div className="flex gap-2"><Button type="button" variant="outline" asChild><a href="/admin/whatsapp/auto-reply">Edit aturan Auto Reply</a></Button><DeleteConfirmation label={`trigger ${editingAutoReplyTrigger.keyword}`} onConfirm={unlinkAutoReplyTrigger} /></div></> : <><div className="space-y-2"><Label>Jenis trigger</Label><Select value={triggerType} onValueChange={(value: FlowTriggerType) => { const config: Record<string, string | number | boolean> = value === "message_received" ? { match_mode: "all" } : value === "label_added" ? { label: "" } : value === "chat_inactive" ? { inactive_minutes: 1440 } : value === "window_expiring" ? { lead_minutes: 60 } : {}; triggerForm.setValue("trigger_type", value); triggerForm.setValue("config", config); triggerForm.setValue("name", value === "message_received" ? "Semua pesan masuk" : TRIGGER_LABELS[value]); setMessageTriggerSource(value === "message_received" ? "auto_reply" : "all_messages"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TRIGGER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>{triggerType === "message_received" ? <><div className="space-y-2"><Label>Pintu masuk pesan</Label><Select value={messageTriggerSource} onValueChange={(value: MessageTriggerSource) => setMessageTriggerSource(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto_reply">Pilih Auto Reply (disarankan)</SelectItem><SelectItem value="all_messages">Semua pesan masuk (lanjutan)</SelectItem></SelectContent></Select></div>{messageTriggerSource === "auto_reply" ? <div className="space-y-2"><Label>Rule Auto Reply</Label><Select value={selectedAutoReplyId} onValueChange={setSelectedAutoReplyId}><SelectTrigger><SelectValue placeholder="Pilih keyword yang sudah dibuat" /></SelectTrigger><SelectContent>{autoReplies.data.map((rule) => <SelectItem key={rule.id} value={rule.id}>{rule.keyword} · {MATCH_LABELS[rule.match_type]}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Keyword dan seluruh aturan tetap dikelola di Auto Reply; flow ini hanya menjadi aksi setelah rule cocok.</p></div> : <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">Flow akan berjalan untuk setiap pesan masuk. Gunakan hanya untuk journey umum yang tidak memakai keyword agar tidak bertabrakan dengan Auto Reply.</div>}</> : <><div className="space-y-2"><Label>Nama</Label><Input {...triggerForm.register("name")} /></div>{triggerType === "label_added" && <div className="space-y-2"><Label>Nama label</Label><Input value={String(triggerConfig?.label ?? "")} onChange={(event) => triggerForm.setValue("config", { label: event.target.value })} placeholder="contoh: siap-bayar" /></div>}{triggerType === "chat_inactive" && <div className="space-y-2"><Label>Tidak aktif (menit)</Label><Input type="number" min={5} value={String(triggerConfig?.inactive_minutes ?? 1440)} onChange={(event) => triggerForm.setValue("config", { inactive_minutes: Number(event.target.value) })} /></div>}{triggerType === "window_expiring" && <div className="space-y-2"><Label>Jalankan sebelum 24 jam habis (menit)</Label><Input type="number" min={5} max={240} value={String(triggerConfig?.lead_minutes ?? 60)} onChange={(event) => triggerForm.setValue("config", { lead_minutes: Number(event.target.value) })} /></div>}</>}<div className="space-y-2"><Label>Prioritas</Label><Input type="number" {...triggerForm.register("priority", { valueAsNumber: true })} /></div><div className="flex items-center justify-between rounded border p-3"><Label>Aktif</Label><Switch checked={triggerActive} onCheckedChange={(value) => triggerForm.setValue("is_active", value)} /></div>{editingTrigger && <DeleteConfirmation label={`trigger ${editingTrigger.name}`} onConfirm={removeDirectTrigger} />}</>}<DialogFooter><Button type="button" variant="outline" onClick={closeTriggerDialog}>Batal</Button><Button type="submit">{editingAutoReplyTrigger ? "Simpan sambungan" : messageTriggerSource === "auto_reply" && triggerType === "message_received" ? "Hubungkan Auto Reply" : "Simpan trigger"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
