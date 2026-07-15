import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createResource, listResource } from "@/services/whatsapp-manager-service";

interface RouteContext {
  params: Promise<{ resource: string }>;
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return supabase;
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Data tidak valid", issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Terjadi kesalahan pada server";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { resource } = await context.params;
    const data = await listResource(supabase, resource, request.nextUrl.searchParams);
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = await getAuthenticatedClient();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { resource } = await context.params;
    const data = await createResource(supabase, resource, await request.json());
    return NextResponse.json({ data, message: "Data berhasil disimpan" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

