"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Save, Settings, Play } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { updateManagerResource } from "@/services/whatsapp-manager-client";
import type { WhatsAppSettings } from "@/types/whatsapp-manager";
import { settingsSchema, type SettingsFormValues } from "@/validation/whatsapp-manager";

const defaults: SettingsFormValues = { 
  api_key: "", 
  admin_phone_id: "",
  admin_phone_number: "",
  bot_phone_id: "",
  bot_phone_number: "",
  webhook_url: "", 
  timezone: "Asia/Jakarta", 
  retry_count: 3, 
  default_delay: 0, 
  debug_mode: false 
};

export function SettingsManager() {
  const settings = useManagerResource<WhatsAppSettings>("settings");
  const form = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema), defaultValues: defaults });
  const timezone = useWatch({ control: form.control, name: "timezone" }) ?? "Asia/Jakarta";
  const debugMode = useWatch({ control: form.control, name: "debug_mode" }) ?? false;
  const current = settings.data[0];

  // Simulator state
  const [simSender, setSimSender] = useState("6281234567890");
  const [simMessage, setSimMessage] = useState("");
  const [simTarget, setSimTarget] = useState("bot"); // 'bot' | 'admin'
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!current) return;
    form.reset({ 
      api_key: current.api_key ?? "", 
      admin_phone_id: current.admin_phone_id ?? "",
      admin_phone_number: current.admin_phone_number ?? "",
      bot_phone_id: current.bot_phone_id ?? "",
      bot_phone_number: current.bot_phone_number ?? "",
      webhook_url: current.webhook_url ?? "", 
      timezone: current.timezone, 
      retry_count: current.retry_count, 
      default_delay: current.default_delay, 
      debug_mode: current.debug_mode 
    });
  }, [current, form]);
  const submit = form.handleSubmit(async (values) => {
    try { const result = await updateManagerResource<WhatsAppSettings>("settings", "global", values); toast.success(result.message ?? "Settings tersimpan"); await settings.refresh(); }
    catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Gagal menyimpan settings"); }
  });

  const runSimulation = async () => {
    if (!simMessage.trim()) return toast.error("Pesan tidak boleh kosong");
    setSimLoading(true);
    try {
      let targetPhoneId = simTarget === "bot" ? current?.bot_phone_id : current?.admin_phone_id;
      let targetPhoneNum = simTarget === "bot" ? current?.bot_phone_number : current?.admin_phone_number;
      
      const payload = {
        event: "message.received",
        data: {
          phoneId: targetPhoneId || "SIMULATION_ID",
          to: targetPhoneNum || "628000000000",
          from: simSender,
          message: { text: simMessage }
        }
      };

      const res = await fetch('/api/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Gagal mensimulasikan pesan");
      toast.success("Webhook simulasi berhasil dikirim!");
      setSimMessage("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSimLoading(false);
    }
  };

  if (settings.loading) return <ResourceLoading />;
  if (settings.error) return <ResourceError message={settings.error} />;
  return (
    <div className="space-y-6">
      <PageHeading title="Settings" description="Konfigurasi global yang digunakan backend WhatsApp Automation Manager." icon={Settings} />
      <form onSubmit={submit} className="space-y-5 max-w-full">
        <Card className="rounded-xl border-border/60 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Integrasi</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key Kirim.dev</Label>
              <Input id="api-key" type="password" autoComplete="off" {...form.register("api_key")} />
              <p className="text-xs text-muted-foreground">Nilai tersimpan selalu dimasking saat dikirim kembali ke browser.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input id="webhook-url" type="url" {...form.register("webhook_url")} />
              {form.formState.errors.webhook_url && <p className="text-xs text-destructive">{form.formState.errors.webhook_url.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Akun WhatsApp (Device)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <div className="font-semibold text-sm">Akun Admin Utama</div>
              <div className="space-y-2">
                <Label htmlFor="admin-phone-id">Phone ID (Admin)</Label>
                <Input id="admin-phone-id" placeholder="Contoh: 12345678" {...form.register("admin_phone_id")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-phone-number">Nomor WhatsApp (Admin)</Label>
                <Input id="admin-phone-number" placeholder="Contoh: 6281234567" {...form.register("admin_phone_number")} />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <div className="font-semibold text-sm">Akun Bot</div>
              <div className="space-y-2">
                <Label htmlFor="bot-phone-id">Phone ID (Bot)</Label>
                <Input id="bot-phone-id" placeholder="Contoh: 87654321" {...form.register("bot_phone_id")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-phone-number">Nomor WhatsApp (Bot)</Label>
                <Input id="bot-phone-number" placeholder="Contoh: 6289876543" {...form.register("bot_phone_number")} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              * Jika form di atas dibiarkan kosong, sistem akan otomatis menggunakan nilai konfigurasi dari file <code>.env</code>.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Runtime</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={(value) => form.setValue("timezone", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem>
                  <SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem>
                  <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retry-count">Retry</Label>
              <Input id="retry-count" type="number" min={0} max={10} {...form.register("retry_count", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-delay">Delay Default (detik)</Label>
              <Input id="default-delay" type="number" min={0} {...form.register("default_delay", { valueAsNumber: true })} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 overflow-hidden">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <Label htmlFor="debug-mode">Debug Mode</Label>
              <p className="mt-1 text-xs text-muted-foreground">Aktifkan pencatatan tambahan pada proses backend.</p>
            </div>
            <Switch id="debug-mode" checked={debugMode} onCheckedChange={(checked) => form.setValue("debug_mode", checked)} />
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button type="submit" disabled={form.formState.isSubmitting}><Save />{form.formState.isSubmitting ? "Menyimpan..." : "Simpan Settings"}</Button></div>
      </form>

      <div className="border-t pt-8 mt-8">
        <PageHeading title="Alat Simulasi (Testing Bot)" description="Tes Auto-Reply atau Flow tanpa menggunakan WhatsApp asli. Sistem akan mensimulasikan webhook dari Kirim.dev." icon={Play} />
        <Card className="rounded-xl border-border/60 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Kirim Pesan Simulasi</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tujuan (Penerima)</Label>
              <Select value={simTarget} onValueChange={setSimTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">Akun Bot (Untuk test Auto-reply)</SelectItem>
                  <SelectItem value="admin">Akun Admin (Untuk test Command)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nomor Pengirim (Customer Palsu)</Label>
              <Input value={simSender} onChange={e => setSimSender(e.target.value)} placeholder="628..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Isi Pesan (Keyword / Perintah)</Label>
              <div className="flex gap-2">
                <Input value={simMessage} onChange={e => setSimMessage(e.target.value)} placeholder="Contoh: halo, atau tesbot" onKeyDown={e => e.key === 'Enter' && runSimulation()} />
                <Button onClick={runSimulation} disabled={simLoading} type="button">
                  {simLoading ? "Mengirim..." : "Kirim Tes"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
