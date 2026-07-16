import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllAccounts, sendTestToAdmin, testConnection } from "@/lib/whatsapp/kirimdev-client";
import { processCustomerMessage, processDueAutoReplyJobs } from "@/services/whatsapp-execution-engine";
import { getOverviewMetrics } from "@/services/whatsapp-manager-service";
import { processDueNotificationJobs, testNotificationRuleToAdmin } from "@/services/whatsapp-notification-service";

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return supabase;
}

export async function GET(request: NextRequest) {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const accounts = await getAllAccounts();
    const metrics = await getOverviewMetrics(supabase);
    return NextResponse.json({
      accounts: accounts.map((account) => ({
        phoneId: account.phoneId,
        label: account.label,
        phoneNumber: account.phoneNumber,
      })),
      metrics,
      webhookUrl: `${request.nextUrl.origin}/api/webhook/whatsapp`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; phoneId?: string; sender?: string; message?: string; ruleId?: string };
    switch (body.action) {
      case "test_connection": {
        if (!body.phoneId) return NextResponse.json({ error: "phoneId diperlukan" }, { status: 400 });
        return NextResponse.json(await testConnection(body.phoneId));
      }
      case "test_auto_reply": {
        const { data, error } = await supabase
          .from("auto_reply")
          .select("id, template:templates!inner(id, is_active)")
          .eq("is_active", true);
        if (error) throw new Error(error.message);
        const validRules = (data ?? []).filter((rule) => {
          const template = Array.isArray(rule.template) ? rule.template[0] : rule.template;
          return template?.is_active !== false;
        });
        return NextResponse.json({
          success: true,
          message: `${validRules.length} auto reply aktif memiliki template yang siap dikirim.`,
        });
      }
      case "simulate_auto_reply": {
        if (!body.message?.trim()) return NextResponse.json({ error: "Pesan simulasi wajib diisi" }, { status: 400 });
        const accounts = await getAllAccounts();
        const result = await processCustomerMessage(
          accounts[1]?.phoneId ?? accounts[0]?.phoneId ?? "SIMULATION",
          body.sender || "6280000000000",
          body.message,
          { dryRun: true },
        );
        return NextResponse.json(result);
      }
      case "process_auto_reply_queue":
        return NextResponse.json({ success: true, ...(await processDueAutoReplyJobs(50)), message: "Antrean jatuh tempo sudah diproses." });
      case "process_notification_queue":
        return NextResponse.json({ success: true, ...(await processDueNotificationJobs(50)), message: "Antrean notifikasi jatuh tempo sudah diproses." });
      case "test_notification_rule": {
        if (!body.ruleId) return NextResponse.json({ error: "ruleId diperlukan" }, { status: 400 });
        const result = await testNotificationRuleToAdmin(body.ruleId);
        if (result.status === "failed") return NextResponse.json({ error: result.error }, { status: 502 });
        return NextResponse.json({ success: true, message: "Tes rule dikirim aman dari Bot ke Admin Utama." });
      }
      case "send_test_to_admin": {
        const accounts = await getAllAccounts();
        if (accounts.length < 2) return NextResponse.json({ error: "Admin Utama dan Bot harus dikonfigurasi" }, { status: 400 });
        const result = await sendTestToAdmin(accounts[1].phoneId, "✅ Tes ILJ Hub berhasil. Pesan ini dikirim dari Bot ke Admin Utama dan tercatat di Activity Log.");
        if (!result.success) return NextResponse.json({ error: result.error ?? "Pesan tes gagal" }, { status: 502 });
        return NextResponse.json({ success: true, message: "Pesan tes Bot → Admin Utama diterima KirimDev.", messageId: result.messageId ?? null });
      }
      case "sync_templates": {
        const { data, error } = await supabase
          .from("templates")
          .update({ synced_at: new Date().toISOString() })
          .eq("is_active", true)
          .select("id");
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true, message: `${data?.length ?? 0} template ditandai tersinkron.` });
      }
      default:
        return NextResponse.json({ error: `Action "${body.action ?? ""}" tidak dikenali` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aksi gagal dijalankan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
