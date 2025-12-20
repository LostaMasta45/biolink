import { createClient } from "@/lib/supabase/client";
import type { QueuePost, PostingPackage, PostingAddon, QueueStatus } from "@/lib/types";

// ============================================
// Fetch Functions
// ============================================

export async function getPackages(): Promise<{ data: PostingPackage[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_packages")
            .select("*")
            .eq("is_active", true)
            .order("id");

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch packages";
        return { data: [], error: errorMessage };
    }
}

export async function getAddons(): Promise<{ data: PostingAddon[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_addons")
            .select("*")
            .eq("is_active", true)
            .order("id");

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch addons";
        return { data: [], error: errorMessage };
    }
}

export async function getPostings(): Promise<{ data: QueuePost[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_queue")
            .select("*")
            .order("scheduled_date", { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch postings";
        return { data: [], error: errorMessage };
    }
}

export async function getPostingById(id: string): Promise<{ data: QueuePost | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_queue")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch posting";
        return { data: null, error: errorMessage };
    }
}

// ============================================
// CRUD Functions
// ============================================

export async function createPosting(posting: Omit<QueuePost, "id" | "created_at" | "updated_at">): Promise<{ data: QueuePost | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_queue")
            .insert({
                company_name: posting.company_name,
                whatsapp_number: posting.whatsapp_number,
                poster_url: posting.poster_url,
                scheduled_date: posting.scheduled_date,
                scheduled_time: posting.scheduled_time,
                package_id: posting.package_id,
                addons: posting.addons,
                total_price: posting.total_price,
                status: posting.status || "draft",
                notes: posting.notes,
            })
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create posting";
        return { data: null, error: errorMessage };
    }
}

export async function updatePosting(id: string, posting: Partial<QueuePost>): Promise<{ data: QueuePost | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_queue")
            .update({
                ...posting,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update posting";
        return { data: null, error: errorMessage };
    }
}

export async function updatePostingStatus(id: string, status: QueueStatus): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from("posting_queue")
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq("id", id);

        if (error) throw error;
        return { success: true, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update status";
        return { success: false, error: errorMessage };
    }
}

export async function deletePosting(id: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();

    try {
        // First get the posting to check for poster_url
        const { data: posting } = await supabase
            .from("posting_queue")
            .select("poster_url")
            .eq("id", id)
            .single();

        // Delete poster from storage if exists
        if (posting?.poster_url) {
            const fileName = posting.poster_url.split("/").pop();
            if (fileName) {
                await supabase.storage.from("posters").remove([fileName]);
            }
        }

        // Delete the posting
        const { error } = await supabase
            .from("posting_queue")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return { success: true, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete posting";
        return { success: false, error: errorMessage };
    }
}

// ============================================
// Storage Functions
// ============================================

export async function uploadPoster(file: File): Promise<{ url: string | null; error: string | null }> {
    const supabase = createClient();

    try {
        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("posters")
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from("posters")
            .getPublicUrl(fileName);

        return { url: publicUrl, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload poster";
        return { url: null, error: errorMessage };
    }
}

export async function deletePoster(url: string): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();

    try {
        const fileName = url.split("/").pop();
        if (!fileName) throw new Error("Invalid URL");

        const { error } = await supabase.storage
            .from("posters")
            .remove([fileName]);

        if (error) throw error;
        return { success: true, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete poster";
        return { success: false, error: errorMessage };
    }
}

// ============================================
// Helper Functions
// ============================================

export function calculateTotalPrice(packagePrice: number, addons: PostingAddon[], selectedAddonIds: number[]): number {
    const addonsTotal = addons
        .filter(addon => selectedAddonIds.includes(addon.id))
        .reduce((sum, addon) => sum + addon.price, 0);

    return packagePrice + addonsTotal;
}

export function formatWhatsAppNumber(number: string): string {
    // Remove all non-digits
    let cleaned = number.replace(/\D/g, "");

    // Convert 08 to 628
    if (cleaned.startsWith("0")) {
        cleaned = "62" + cleaned.substring(1);
    }

    // Add 62 if not present
    if (!cleaned.startsWith("62")) {
        cleaned = "62" + cleaned;
    }

    return cleaned;
}

export function generateWhatsAppLink(number: string, message?: string): string {
    const formattedNumber = formatWhatsAppNumber(number);
    const encodedMessage = message ? encodeURIComponent(message) : "";
    return `https://wa.me/${formattedNumber}${encodedMessage ? `?text=${encodedMessage}` : ""}`;
}
