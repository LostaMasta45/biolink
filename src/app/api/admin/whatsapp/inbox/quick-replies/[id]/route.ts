import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteInboxQuickReply, updateInboxQuickReply } from "@/services/whatsapp-inbox-store";

interface RouteContext { params: Promise<{ id: string }>; }
const updateSchema = z.object({ shortcut: z.string().trim().min(1).max(40).regex(/^\/?[a-z0-9_-]+$/i, "Shortcut hanya huruf, angka, - atau _"), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() });
async function authenticated() { const supabase = await createClient(); const { data: { user }, error } = await supabase.auth.getUser(); return error || !user ? null : user; }

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { id } = await context.params; return NextResponse.json({ data: await updateInboxQuickReply(id, updateSchema.parse(await request.json())) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Balas Cepat tidak dapat diperbarui" }, { status: 400 }); }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { const { id } = await context.params; await deleteInboxQuickReply(id); return NextResponse.json({ data: null }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Balas Cepat tidak dapat dihapus" }, { status: 500 }); }
}
