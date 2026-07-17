import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createInboxQuickReply, listInboxQuickReplies } from "@/services/whatsapp-inbox-store";

const createSchema = z.object({ templateId: z.string().uuid(), shortcut: z.string().trim().min(1).max(40).regex(/^\/?[a-z0-9_-]+$/i, "Shortcut hanya huruf, angka, - atau _"), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() });
async function authenticated() { const supabase = await createClient(); const { data: { user }, error } = await supabase.auth.getUser(); return error || !user ? null : user; }

export async function GET() {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ data: await listInboxQuickReplies() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Balas Cepat tidak dapat dimuat" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ data: await createInboxQuickReply(createSchema.parse(await request.json())) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Balas Cepat tidak dapat disimpan" }, { status: 400 }); }
}
