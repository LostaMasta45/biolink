"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { addEdge, Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, GripVertical, Play, Plus, Radio, Trash2 } from "lucide-react";
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
import type { CustomerFlow, FlowNode, FlowRun, FlowRunStep, FlowTrigger, FlowTriggerType, WhatsAppTemplate } from "@/types/whatsapp-manager";
import { flowNodeSchema, flowSchema, flowTriggerSchema, type FlowFormValues, type FlowTriggerFormValues } from "@/validation/whatsapp-manager";

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

const FLOW_DEFAULTS: FlowFormValues = { name: "Customer Journey", description: "Flow customer InfoLokerJombang", is_active: true };
const NODE_DEFAULTS: NodeFormValues = { flow_id: "", name: "", description: "", position: 0, template_id: null, automation_id: null, next_node_id: null, execution_mode: "send_and_wait", delay_seconds: 0, position_x: 360, position_y: 120 };
const TRIGGER_DEFAULTS: FlowTriggerFormValues = { flow_id: "", trigger_type: "message_received", name: "Pesan masuk", config: { match_mode: "all" }, priority: 0, is_active: true };

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

export function FlowBuilder() {
  const flows = useManagerResource<CustomerFlow>("flows");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
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
  const [triggerDialog, setTriggerDialog] = useState(false);
  const flowForm = useForm<FlowFormValues>({ resolver: zodResolver(flowSchema), defaultValues: FLOW_DEFAULTS });
  const nodeForm = useForm<NodeFormValues>({ resolver: zodResolver(flowNodeSchema), defaultValues: NODE_DEFAULTS });
  const triggerForm = useForm<FlowTriggerFormValues>({ resolver: zodResolver(flowTriggerSchema), defaultValues: TRIGGER_DEFAULTS });
  const executionMode = useWatch({ control: nodeForm.control, name: "execution_mode" });
  const triggerType = useWatch({ control: triggerForm.control, name: "trigger_type" });
  const selectedFlow = useMemo(() => flows.data.find((flow) => flow.id === activeFlowId), [activeFlowId, flows.data]);

  useEffect(() => {
    const firstNode = nodes.data[0];
    const triggerCanvasNodes: Node[] = triggers.data.map((trigger, index) => ({
      id: `trigger:${trigger.id}`,
      position: { x: 20, y: index * 130 + 70 },
      data: { label: `⚡ ${trigger.name}\n${TRIGGER_LABELS[trigger.trigger_type]}` },
      draggable: false,
      style: { width: 220, whiteSpace: "pre-line", border: "1px solid #22c55e", borderRadius: 12, background: "#052e16", color: "#dcfce7", padding: 12 },
    }));
    const flowCanvasNodes: Node[] = nodes.data.map((node) => ({
      id: node.id,
      position: { x: node.position_x, y: node.position_y },
      data: { label: `${node.name}\n${MODE_LABELS[node.execution_mode]}${node.template?.name ? `\n${node.template.name}` : ""}` },
      style: { width: 250, whiteSpace: "pre-line", border: "1px solid #6366f1", borderRadius: 12, background: "#111827", color: "#f8fafc", padding: 12 },
    }));
    const transitionEdges: Edge[] = nodes.data.flatMap((node) => node.next_node_id ? [{ id: `edge:${node.id}:${node.next_node_id}`, source: node.id, target: node.next_node_id, label: "Next", animated: node.execution_mode === "send_and_continue" }] : []);
    const triggerEdges: Edge[] = firstNode ? triggers.data.map((trigger) => ({ id: `trigger-edge:${trigger.id}`, source: `trigger:${trigger.id}`, target: firstNode.id, label: "Mulai", style: { stroke: "#22c55e" }, labelStyle: { fill: "#16a34a" } })) : [];
    setCanvasNodes([...triggerCanvasNodes, ...flowCanvasNodes]);
    setCanvasEdges([...triggerEdges, ...transitionEdges]);
  }, [nodes.data, setCanvasEdges, setCanvasNodes, triggers.data]);

  useEffect(() => {
    if (!editingNode) return;
    nodeForm.reset(nodePayload(editingNode));
  }, [editingNode, nodeForm]);

  const openTrigger = (trigger: FlowTrigger | null) => {
    setEditingTrigger(trigger);
    triggerForm.reset(trigger ? { flow_id: trigger.flow_id, trigger_type: trigger.trigger_type, name: trigger.name, config: trigger.config, priority: trigger.priority, is_active: trigger.is_active } : { ...TRIGGER_DEFAULTS, flow_id: activeFlowId });
    setTriggerDialog(true);
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
      if (editingTrigger) await updateManagerResource<FlowTrigger>("flow_triggers", editingTrigger.id, values);
      else await createManagerResource<FlowTrigger>("flow_triggers", values);
      toast.success("Trigger disimpan");
      setTriggerDialog(false);
      await triggers.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan trigger"); }
  });

  const createNode = async () => {
    if (!activeFlowId) return;
    try {
      const maxPosition = Math.max(-1, ...nodes.data.map((node) => node.position));
      await createManagerResource<FlowNode>("flow_nodes", { ...NODE_DEFAULTS, flow_id: activeFlowId, name: `Node ${maxPosition + 2}`, position: maxPosition + 1, position_x: 620, position_y: Math.max(80, nodes.data.length * 130) });
      await nodes.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menambah node"); }
  };

  const onConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source.startsWith("trigger:") || connection.target.startsWith("trigger:")) return;
    const source = nodes.data.find((node) => node.id === connection.source);
    if (!source) return;
    try {
      await updateManagerResource<FlowNode>("flow_nodes", source.id, nodePayload(source, { next_node_id: connection.target }));
      setCanvasEdges((edges) => addEdge({ ...connection, label: "Next" }, edges));
      await nodes.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Koneksi node gagal disimpan"); }
  };

  const onNodeDragStop = async (_event: MouseEvent | TouchEvent, canvasNode: Node) => {
    if (canvasNode.id.startsWith("trigger:")) return;
    const source = nodes.data.find((node) => node.id === canvasNode.id);
    if (!source) return;
    try { await updateManagerResource<FlowNode>("flow_nodes", source.id, nodePayload(source, { position_x: Math.round(canvasNode.position.x), position_y: Math.round(canvasNode.position.y) })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Posisi node gagal disimpan"); }
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
    try { await deleteManagerResource("flows", selectedFlow.id); setSelectedFlowId(""); await flows.refresh(); toast.success("Flow dihapus"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus flow"); }
  };

  if (flows.loading || templates.loading) return <ResourceLoading />;
  if (flows.error || templates.error || nodes.error || triggers.error) return <ResourceError message={flows.error ?? templates.error ?? nodes.error ?? triggers.error ?? "Gagal memuat Flow Builder"} />;

  return <div className="space-y-6">
    <PageHeading title="Flow Builder" description="Canvas drag-and-drop untuk journey WhatsApp. Tarik node, hubungkan Next Step, lalu pantau eksekusinya." icon={GitBranch} action={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!activeFlowId} onClick={validateFlow}><Play />Validasi</Button><Button onClick={() => { flowForm.reset(FLOW_DEFAULTS); setFlowDialog(true); }}><Plus />Flow</Button></div>} />
    {flows.data.length === 0 ? <EmptyState title="Belum ada Flow Map" description="Buat flow pertama, lalu tambahkan trigger dan konfigurasi node pada canvas." /> : <>
      <Card><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end"><div className="flex-1 space-y-2"><Label>Flow aktif</Label><Select value={activeFlowId} onValueChange={setSelectedFlowId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{flows.data.map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}</SelectContent></Select></div><Badge variant={selectedFlow?.is_active ? "default" : "secondary"}>{selectedFlow?.is_active ? "Aktif" : "Nonaktif"}</Badge><Button variant="outline" onClick={createNode}><Plus />Node</Button><Button variant="outline" onClick={() => openTrigger(null)}><Radio />Trigger</Button>{selectedFlow && <DeleteConfirmation label={selectedFlow.name} onConfirm={removeFlow} />}</CardContent></Card>
      <Card className="overflow-hidden"><CardContent className="p-0"><div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground"><GripVertical className="h-4 w-4" /> Geser node untuk menyimpan posisi. Tarik konektor dari node ke node tujuan untuk menetapkan Next Step.</div><div className="h-[620px]"><ReactFlow nodes={canvasNodes} edges={canvasEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onNodeClick={(_event, node) => { const trigger = node.id.startsWith("trigger:") ? triggers.data.find((item) => item.id === node.id.slice(8)) : null; const flowNode = nodes.data.find((item) => item.id === node.id); if (trigger) openTrigger(trigger); if (flowNode) setEditingNode(flowNode); }} fitView><MiniMap pannable zoomable /><Controls /><Background gap={18} size={1} /></ReactFlow></div></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2"><Card><CardContent className="p-4"><p className="mb-3 font-semibold">Trigger aktif</p>{triggers.data.length ? <div className="space-y-2">{triggers.data.map((trigger) => <button key={trigger.id} type="button" onClick={() => openTrigger(trigger)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"><span><b>{trigger.name}</b><span className="block text-xs text-muted-foreground">{TRIGGER_LABELS[trigger.trigger_type]}</span></span><Badge variant={trigger.is_active ? "default" : "secondary"}>{trigger.is_active ? "Aktif" : "Nonaktif"}</Badge></button>)}</div> : <p className="text-sm text-muted-foreground">Tambahkan trigger untuk menjalankan flow tanpa bergantung pada keyword.</p>}</CardContent></Card><Card><CardContent className="p-4"><p className="mb-3 font-semibold">Eksekusi terbaru</p>{latestRun ? <div className="space-y-2"><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">{latestRun.status}</Badge><span>{latestRun.customer}</span><span className="text-muted-foreground">{latestRun.current_node?.name ?? "Selesai"}</span></div>{steps.data.slice(-6).map((step) => <div key={step.id} className="flex justify-between rounded bg-muted/50 px-3 py-2 text-sm"><span>{step.sequence}. {step.node?.name ?? "Node"}</span><Badge variant="secondary">{step.status}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Belum ada run untuk flow ini.</p>}</CardContent></Card></div>
    </>}

    <Dialog open={flowDialog} onOpenChange={setFlowDialog}><DialogContent><DialogHeader><DialogTitle>Flow Map baru</DialogTitle><DialogDescription>Flow baru berisi node dasar yang dapat Anda susun ulang di canvas.</DialogDescription></DialogHeader><form onSubmit={createFlow} className="space-y-4"><div className="space-y-2"><Label>Nama</Label><Input {...flowForm.register("name")} /></div><div className="space-y-2"><Label>Deskripsi</Label><Textarea {...flowForm.register("description")} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFlowDialog(false)}>Batal</Button><Button type="submit">Buat Flow</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(editingNode)} onOpenChange={(open) => !open && setEditingNode(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Node flow</DialogTitle><DialogDescription>Pesan free-form hanya dipakai bila customer masih berada di jendela layanan WhatsApp 24 jam.</DialogDescription></DialogHeader><form onSubmit={saveNode} className="space-y-4"><div className="space-y-2"><Label>Nama</Label><Input {...nodeForm.register("name")} /></div><div className="space-y-2"><Label>Deskripsi</Label><Textarea {...nodeForm.register("description")} /></div><div className="space-y-2"><Label>Mode</Label><Select value={executionMode} onValueChange={(value: FlowNode["execution_mode"]) => nodeForm.setValue("execution_mode", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Pesan Tersimpan</Label><Select value={nodeForm.watch("template_id") ?? "none"} onValueChange={(value) => nodeForm.setValue("template_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa pesan</SelectItem>{templates.data.filter((template) => template.is_active).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Delay (detik)</Label><Input type="number" min={0} max={5} {...nodeForm.register("delay_seconds", { valueAsNumber: true })} /><p className="text-xs text-muted-foreground">Delay lebih dari 5 detik perlu scheduler per menit dan ditolak oleh validasi agar tidak tersangkut.</p></div><div className="space-y-2"><Label>Next Step</Label><Select value={nodeForm.watch("next_node_id") ?? "none"} onValueChange={(value) => nodeForm.setValue("next_node_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Selesaikan flow</SelectItem>{nodes.data.filter((node) => node.id !== editingNode?.id).map((node) => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditingNode(null)}>Batal</Button><Button type="submit">Simpan</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={triggerDialog} onOpenChange={setTriggerDialog}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingTrigger ? "Edit trigger" : "Trigger baru"}</DialogTitle><DialogDescription>Trigger hanya menggunakan event webhook KirimDev yang benar-benar tersedia atau scheduler lokal untuk trigger waktu.</DialogDescription></DialogHeader><form onSubmit={saveTrigger} className="space-y-4"><div className="space-y-2"><Label>Jenis trigger</Label><Select value={triggerType} onValueChange={(value: FlowTriggerType) => { const config: Record<string, string | number | boolean> = value === "message_received" ? { match_mode: "all" } : value === "label_added" ? { label: "" } : value === "chat_inactive" ? { inactive_minutes: 1440 } : value === "window_expiring" ? { lead_minutes: 60 } : {}; triggerForm.setValue("trigger_type", value); triggerForm.setValue("config", config); triggerForm.setValue("name", TRIGGER_LABELS[value]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TRIGGER_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Nama</Label><Input {...triggerForm.register("name")} /></div>{triggerType === "message_received" && <><div className="space-y-2"><Label>Pencocokan pesan</Label><Select value={String(triggerForm.watch("config.match_mode") ?? "all")} onValueChange={(value) => triggerForm.setValue("config", { ...triggerForm.getValues("config"), match_mode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua pesan</SelectItem><SelectItem value="equals">Sama persis</SelectItem><SelectItem value="starts_with">Diawali</SelectItem><SelectItem value="contains">Mengandung</SelectItem></SelectContent></Select></div>{triggerForm.watch("config.match_mode") !== "all" && <div className="space-y-2"><Label>Keyword</Label><Input value={String(triggerForm.watch("config.keyword") ?? "")} onChange={(event) => triggerForm.setValue("config", { ...triggerForm.getValues("config"), keyword: event.target.value })} /></div>}</>}{triggerType === "label_added" && <div className="space-y-2"><Label>Nama label</Label><Input value={String(triggerForm.watch("config.label") ?? "")} onChange={(event) => triggerForm.setValue("config", { label: event.target.value })} placeholder="contoh: siap-bayar" /></div>}{triggerType === "chat_inactive" && <div className="space-y-2"><Label>Tidak aktif (menit)</Label><Input type="number" min={5} value={String(triggerForm.watch("config.inactive_minutes") ?? 1440)} onChange={(event) => triggerForm.setValue("config", { inactive_minutes: Number(event.target.value) })} /></div>}{triggerType === "window_expiring" && <div className="space-y-2"><Label>Jalankan sebelum 24 jam habis (menit)</Label><Input type="number" min={5} max={240} value={String(triggerForm.watch("config.lead_minutes") ?? 60)} onChange={(event) => triggerForm.setValue("config", { lead_minutes: Number(event.target.value) })} /></div>}<div className="space-y-2"><Label>Prioritas</Label><Input type="number" {...triggerForm.register("priority", { valueAsNumber: true })} /></div><div className="flex items-center justify-between rounded border p-3"><Label>Aktif</Label><Switch checked={triggerForm.watch("is_active")} onCheckedChange={(value) => triggerForm.setValue("is_active", value)} /></div>{editingTrigger && <Button type="button" variant="destructive" onClick={async () => { await deleteManagerResource("flow_triggers", editingTrigger.id); setTriggerDialog(false); await triggers.refresh(); }}><Trash2 />Hapus trigger</Button>}<DialogFooter><Button type="button" variant="outline" onClick={() => setTriggerDialog(false)}>Batal</Button><Button type="submit">Simpan trigger</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
