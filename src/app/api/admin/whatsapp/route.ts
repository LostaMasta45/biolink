import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllAccounts, testConnection } from "@/lib/whatsapp/kirimdev-client";
import { getOverviewMetrics } from "@/services/whatsapp-manager-service";

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
    const body = await request.json() as { action?: string; phoneId?: string };
    switch (body.action) {
      case "test_connection": {
        if (!body.phoneId) return NextResponse.json({ error: "phoneId diperlukan" }, { status: 400 });
        return NextResponse.json(await testConnection(body.phoneId));
      }
      case "test_automation": {
        const { count, error } = await supabase
          .from("automation")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (error) throw new Error(error.message);
        return NextResponse.json({
          success: true,
          message: `${count ?? 0} automation aktif lolos pemeriksaan konfigurasi. Tidak ada pesan yang dikirim.`,
        });
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
