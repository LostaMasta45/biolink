import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateInboxConversation } from "@/services/whatsapp-inbox-store";

interface RouteContext { params: Promise<{ id: string }>; }
const patchSchema = z.object({
  status: z.enum(["open", "pending", "resolved"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  markRead: z.boolean().optional(),
});

async function authenticated() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await updateInboxConversation(id, patchSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Percakapan tidak dapat diperbarui" }, { status: 400 });
  }
}
