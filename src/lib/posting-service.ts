import { createClient } from "@/lib/supabase/client";
import type { QueuePost, PostingPackage, PostingAddon, QueueStatus } from "@/lib/types";
import { formatNewLokerMessage, formatStatusChangeMessage, sendTelegramMessage, sendTelegramPhoto } from "./telegram-service";
import { syncPostingToTransaction } from "./finance-service";

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

        // Transform pipe-separated urls into gallery array
        const posts = (data || []).map((post: QueuePost) => ({
            ...post,
            gallery: post.poster_url ? post.poster_url.split('|') : []
        }));

        return { data: posts, error: null };
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

        if (data) {
            // Transform pipe-separated urls into gallery array
            (data as QueuePost).gallery = data.poster_url ? data.poster_url.split('|') : [];
        }

        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch posting";
        return { data: null, error: errorMessage };
    }
}

// ============================================
// CRUD Functions
// ============================================

export async function createPosting(posting: Omit<QueuePost, "id" | "created_at" | "updated_at" | "gallery"> & { gallery?: string[] }): Promise<{ data: QueuePost | null; error: string | null }> {
    const supabase = createClient();

    try {
        // If gallery exists, join it to poster_url
        const posterUrl = posting.gallery && posting.gallery.length > 0
            ? posting.gallery.join('|')
            : posting.poster_url;

        const { data, error } = await supabase
            .from("posting_queue")
            .insert({
                company_name: posting.company_name,
                whatsapp_number: posting.whatsapp_number,
                poster_url: posterUrl,
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

        if (data) {
            (data as QueuePost).gallery = data.poster_url ? data.poster_url.split('|') : [];

            // Sync to finance if not draft
            if (data.status !== "draft") {
                await syncPostingToTransaction({
                    id: data.id,
                    company_name: data.company_name,
                    total_price: data.total_price,
                    scheduled_date: data.scheduled_date
                });
            }

            // Send Telegram Notification
            try {
                const message = formatNewLokerMessage(data as QueuePost);
                const poster = (data as QueuePost).gallery?.[0] || (data as QueuePost).poster_url;

                if (poster) {
                    await sendTelegramPhoto(poster, message);
                } else {
                    await sendTelegramMessage(message);
                }
            } catch (err) {
                console.error("Failed to send telegram notification", err);
            }
        }

        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create posting";
        return { data: null, error: errorMessage };
    }
}

export async function updatePosting(id: string, posting: Partial<QueuePost>): Promise<{ data: QueuePost | null; error: string | null }> {
    const supabase = createClient();

    try {
        const updateData: any = { ...posting, updated_at: new Date().toISOString() };

        // Handle gallery update
        if (posting.gallery) {
            updateData.poster_url = posting.gallery.length > 0 ? posting.gallery.join('|') : null;
            delete updateData.gallery;
        }

        const { data, error } = await supabase
            .from("posting_queue")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            (data as QueuePost).gallery = data.poster_url ? data.poster_url.split('|') : [];

            // Sync to finance if not draft
            if (data.status !== "draft") {
                await syncPostingToTransaction({
                    id: data.id,
                    company_name: data.company_name,
                    total_price: data.total_price,
                    scheduled_date: data.scheduled_date
                });
            }

            // Send Telegram Notification (Optional context: only on major updates?)
            // We'll trust the user wants reports on "updates" too if status is relevant
            try {
                if (data.status !== "draft") {
                    const message = formatNewLokerMessage(data as QueuePost);
                    const poster = (data as QueuePost).gallery?.[0] || (data as QueuePost).poster_url;

                    // Differentiate update vs new? For simplicity, we resend the info card.
                    if (poster) {
                        await sendTelegramPhoto(poster, message + "\n\n(Updated)");
                    }
                }
            } catch (err) {
                console.error("Failed to send telegram notification", err);
            }
        }

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

        // Sync to finance if not draft
        if (status !== "draft") {
            const { data: posting } = await getPostingById(id);
            if (posting) {
                await syncPostingToTransaction({
                    id: posting.id,
                    company_name: posting.company_name,
                    total_price: posting.total_price,
                    scheduled_date: posting.scheduled_date
                });

                // Send Telegram Notification
                try {
                    const poster = posting.gallery?.[0] || posting.poster_url;
                    let message = "";

                    if (status === "posted") {
                        message = `<b>✅ LOKER SUDAH DIPOSTING!</b>\n\n🏢 <b>${posting.company_name}</b> sekarang live.\n\n<a href="${poster}">Lihat Poster</a>`;
                        if (poster) await sendTelegramPhoto(poster, message);
                        else await sendTelegramMessage(message);
                    } else if (status === "queued") {
                        message = formatNewLokerMessage(posting);
                        if (poster) await sendTelegramPhoto(poster, message);
                        else await sendTelegramMessage(message);
                    } else {
                        message = formatStatusChangeMessage(posting, "Previous", status);
                        await sendTelegramMessage(message);
                    }
                } catch (err) {
                    console.error("Failed to send telegram notification", err);
                }
            }
        }

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
