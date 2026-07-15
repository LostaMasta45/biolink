"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ArrowDown, GitBranch, Pencil, Plus } from "lucide-react";
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
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { createManagerResource, deleteManagerResource, updateManagerResource } from "@/services/whatsapp-manager-client";
import type { AutomationRule, CustomerFlow, FlowNode, WhatsAppTemplate } from "@/types/whatsapp-manager";
import { flowNodeSchema, flowSchema, type FlowFormValues } from "@/validation/whatsapp-manager";

interface NodeFormValues {
  flow_id: string;
  name: string;
  description?: string | null;
  position: number;
  template_id?: string | null;
  automation_id?: string | null;
  next_node_id?: string | null;
}

const flowDefaults: FlowFormValues = { name: "Customer Journey", description: "Flow customer Infolokerjombang", is_active: true };

export function FlowBuilder() {
  const flows = useManagerResource<CustomerFlow>("flows");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const automations = useManagerResource<AutomationRule>("automation");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const activeFlowId = selectedFlowId || flows.data[0]?.id || "";
  const nodes = useManagerResource<FlowNode>("flow_nodes", activeFlowId ? `?flow_id=${activeFlowId}` : "?flow_id=none");
  const [flowDialog, setFlowDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const flowForm = useForm<FlowFormValues>({ resolver: zodResolver(flowSchema), defaultValues: flowDefaults });
  const nodeForm = useForm<NodeFormValues>({ resolver: zodResolver(flowNodeSchema), defaultValues: { flow_id: "", name: "", description: "", position: 0, template_id: null, automation_id: null, next_node_id: null } });
  const flowActive = useWatch({ control: flowForm.control, name: "is_active" }) ?? true;
  const nodeTemplateId = useWatch({ control: nodeForm.control, name: "template_id" });
  const nodeAutomationId = useWatch({ control: nodeForm.control, name: "automation_id" });
  const nextNodeId = useWatch({ control: nodeForm.control, name: "next_node_id" });

  useEffect(() => {
    if (!editingNode) return;
    nodeForm.reset({
      flow_id: editingNode.flow_id, name: editingNode.name, description: editingNode.description,
      position: editingNode.position, template_id: editingNode.template_id,
      automation_id: editingNode.automation_id, next_node_id: editingNode.next_node_id,
    });
  }, [editingNode, nodeForm]);

  const selectedFlow = useMemo(() => flows.data.find((flow) => flow.id === activeFlowId), [activeFlowId, flows.data]);
  const createFlow = flowForm.handleSubmit(async (values) => {
    try {
      const result = await createManagerResource<CustomerFlow>("flows", values);
      toast.success("Flow dan node default berhasil dibuat"); setFlowDialog(false); await flows.refresh(); setSelectedFlowId(result.data.id);
    } catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Gagal membuat flow"); }
  });
  const updateNode = nodeForm.handleSubmit(async (values) => {
    if (!editingNode) return;
    try { await updateManagerResource<FlowNode>("flow_nodes", editingNode.id, values); toast.success("Node diperbarui"); setEditingNode(null); await nodes.refresh(); }
    catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Gagal memperbarui node"); }
  });
  const removeFlow = async () => {
    if (!selectedFlow) return;
    try { await deleteManagerResource("flows", selectedFlow.id); toast.success("Flow dihapus"); setSelectedFlowId(""); await flows.refresh(); }
    catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus flow"); }
  };

  if (flows.loading || templates.loading || automations.loading) return <ResourceLoading />;
  if (flows.error || templates.error || automations.error) return <ResourceError message={flows.error ?? templates.error ?? automations.error ?? "Gagal memuat data"} />;

  return (
    <div className="space-y-6">
      <PageHeading title="Flow Builder" description="Visualisasi customer journey. Flow hanya menyimpan konfigurasi dan tidak mengirim WhatsApp." icon={GitBranch} action={<Button onClick={() => { flowForm.reset(flowDefaults); setFlowDialog(true); }}><Plus />Flow</Button>} />
      {flows.data.length === 0 ? <EmptyState title="Belum ada flow" description="Buat flow pertama untuk menghasilkan customer journey default sesuai PRD." /> : <>
        <div className="flex flex-col gap-3 rounded-xl border bg-card/70 p-4 sm:flex-row sm:items-center">
          <div className="flex-1"><Label>Flow aktif</Label><Select value={activeFlowId} onValueChange={setSelectedFlowId}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{flows.data.map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}</SelectContent></Select></div>
          {selectedFlow && <div className="flex items-center gap-2 self-end"><Badge variant={selectedFlow.is_active ? "default" : "secondary"}>{selectedFlow.is_active ? "Aktif" : "Nonaktif"}</Badge><DeleteConfirmation label={selectedFlow.name} onConfirm={removeFlow} /></div>}
        </div>
        {nodes.loading ? <ResourceLoading /> : nodes.error ? <ResourceError message={nodes.error} /> : (
          <div className="mx-auto max-w-3xl">
            {nodes.data.map((node, index) => (
              <div key={node.id} className="flex flex-col items-center">
                <Card className="w-full rounded-xl border-primary/15 bg-card/90 shadow-sm">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</div>
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-semibold">{node.name}</p>{index === 0 && <Badge variant="outline">Start</Badge>}{index === nodes.data.length - 1 && <Badge variant="outline">Done</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{node.description}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="secondary">Template: {node.template?.name ?? "Belum dipilih"}</Badge><Badge variant="secondary">Automation: {node.automation?.name ?? "Belum dipilih"}</Badge><Badge variant="outline">Next: {nodes.data.find((candidate) => candidate.id === node.next_node_id)?.name ?? (index === nodes.data.length - 1 ? "Selesai" : "Belum diatur")}</Badge></div></div>
                    <Button size="icon" variant="ghost" onClick={() => setEditingNode(node)} aria-label={`Edit ${node.name}`}><Pencil /></Button>
                  </CardContent>
                </Card>
                {index < nodes.data.length - 1 && <ArrowDown className="my-2 h-5 w-5 text-primary" />}
              </div>
            ))}
          </div>
        )}
      </>}

      <Dialog open={flowDialog} onOpenChange={setFlowDialog}><DialogContent><DialogHeader><DialogTitle>Flow Baru</DialogTitle><DialogDescription>Flow baru otomatis memakai urutan customer journey default PRD.</DialogDescription></DialogHeader><form onSubmit={createFlow} className="space-y-4"><div className="space-y-2"><Label htmlFor="flow-name">Nama</Label><Input id="flow-name" {...flowForm.register("name")} /></div><div className="space-y-2"><Label htmlFor="flow-description">Deskripsi</Label><Textarea id="flow-description" {...flowForm.register("description")} /></div><div className="flex items-center justify-between rounded-xl border p-3"><Label htmlFor="flow-active">Aktif</Label><Switch id="flow-active" checked={flowActive} onCheckedChange={(checked) => flowForm.setValue("is_active", checked)} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFlowDialog(false)}>Batal</Button><Button type="submit" disabled={flowForm.formState.isSubmitting}>Buat Flow</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={Boolean(editingNode)} onOpenChange={(value) => !value && setEditingNode(null)}><DialogContent><DialogHeader><DialogTitle>Konfigurasi Node</DialogTitle><DialogDescription>Atur template, automation, dan langkah berikutnya tanpa menjalankan pesan.</DialogDescription></DialogHeader><form onSubmit={updateNode} className="space-y-4"><div className="space-y-2"><Label htmlFor="node-name">Nama</Label><Input id="node-name" {...nodeForm.register("name")} /></div><div className="space-y-2"><Label htmlFor="node-description">Deskripsi</Label><Textarea id="node-description" {...nodeForm.register("description")} /></div><div className="space-y-2"><Label>Template</Label><Select value={nodeTemplateId ?? "none"} onValueChange={(value) => nodeForm.setValue("template_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Belum dipilih</SelectItem>{templates.data.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Automation</Label><Select value={nodeAutomationId ?? "none"} onValueChange={(value) => nodeForm.setValue("automation_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Belum dipilih</SelectItem>{automations.data.map((rule) => <SelectItem key={rule.id} value={rule.id}>{rule.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Next Step</Label><Select value={nextNodeId ?? "none"} onValueChange={(value) => nodeForm.setValue("next_node_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Selesai / belum diatur</SelectItem>{nodes.data.filter((node) => node.id !== editingNode?.id).map((node) => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditingNode(null)}>Batal</Button><Button type="submit" disabled={nodeForm.formState.isSubmitting}>Simpan Node</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
