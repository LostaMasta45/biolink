import { createClient } from "@/lib/supabase/client";
import type { QueuePost, AggregatedClient, ClientDetail, ClientTier } from "@/lib/types";

// ============================================
// Helper Functions
// ============================================

export function getClientTier(totalPostings: number): ClientTier {
    if (totalPostings >= 20) return "platinum";
    if (totalPostings >= 10) return "gold";
    if (totalPostings >= 5) return "silver";
    return "bronze";
}

export function getTierColor(tier: ClientTier): { bg: string; text: string; border: string } {
    const colors = {
        bronze: { bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/20" },
        silver: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/20" },
        gold: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
        platinum: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/20" },
    };
    return colors[tier];
}

export function getTierLabel(tier: ClientTier): string {
    const labels = {
        bronze: "Bronze",
        silver: "Silver",
        gold: "Gold",
        platinum: "Platinum",
    };
    return labels[tier];
}

// ============================================
// Fetch Functions
// ============================================

export async function getAggregatedClients(): Promise<{ data: AggregatedClient[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_queue")
            .select("*")
            .order("scheduled_date", { ascending: false });

        if (error) throw error;

        // Aggregate data by whatsapp_number
        const clientMap = new Map<string, {
            company_name: string;
            total_postings: number;
            total_spent: number;
            dates: string[];
            posters: string[];
        }>();

        (data || []).forEach((post: QueuePost) => {
            const key = post.whatsapp_number;
            const existing = clientMap.get(key);

            if (existing) {
                existing.total_postings += 1;
                existing.total_spent += post.total_price;
                existing.dates.push(post.scheduled_date);
                if (post.poster_url) {
                    existing.posters.push(post.poster_url);
                }
                // Use the most recent company name
                if (post.scheduled_date > existing.dates[0]) {
                    existing.company_name = post.company_name;
                }
            } else {
                clientMap.set(key, {
                    company_name: post.company_name,
                    total_postings: 1,
                    total_spent: post.total_price,
                    dates: [post.scheduled_date],
                    posters: post.poster_url ? [post.poster_url] : [],
                });
            }
        });

        // Convert to array
        const clients: AggregatedClient[] = Array.from(clientMap.entries()).map(([whatsapp_number, data]) => {
            const sortedDates = data.dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            return {
                whatsapp_number,
                company_name: data.company_name,
                total_postings: data.total_postings,
                total_spent: data.total_spent,
                last_posting_date: sortedDates[0],
                first_posting_date: sortedDates[sortedDates.length - 1],
                poster_gallery: data.posters.slice(0, 10), // Limit to 10 posters
                tier: getClientTier(data.total_postings),
            };
        });

        // Sort by total postings (most first)
        clients.sort((a, b) => b.total_postings - a.total_postings);

        return { data: clients, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch clients";
        return { data: [], error: errorMessage };
    }
}

export async function getClientDetail(whatsappNumber: string): Promise<{ data: ClientDetail | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("posting_queue")
            .select("*")
            .eq("whatsapp_number", whatsappNumber)
            .order("scheduled_date", { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
            return { data: null, error: "Client not found" };
        }

        const posts = data as QueuePost[];
        const totalSpent = posts.reduce((sum, post) => sum + post.total_price, 0);
        const posters = posts.filter(p => p.poster_url).map(p => p.poster_url!);
        const sortedDates = posts.map(p => p.scheduled_date).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        const clientDetail: ClientDetail = {
            whatsapp_number: whatsappNumber,
            company_name: posts[0].company_name, // Most recent company name
            total_postings: posts.length,
            total_spent: totalSpent,
            last_posting_date: sortedDates[0],
            first_posting_date: sortedDates[sortedDates.length - 1],
            poster_gallery: posters,
            tier: getClientTier(posts.length),
            posting_history: posts,
        };

        return { data: clientDetail, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch client detail";
        return { data: null, error: errorMessage };
    }
}

// ============================================
// Statistics Functions
// ============================================

export interface ClientStats {
    totalClients: number;
    vipClients: number; // Gold + Platinum
    newThisMonth: number;
    totalRevenue: number;
}

export async function getClientStats(): Promise<{ data: ClientStats; error: string | null }> {
    const { data: clients, error } = await getAggregatedClients();

    if (error) {
        return {
            data: { totalClients: 0, vipClients: 0, newThisMonth: 0, totalRevenue: 0 },
            error,
        };
    }

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const stats: ClientStats = {
        totalClients: clients.length,
        vipClients: clients.filter(c => c.tier === "gold" || c.tier === "platinum").length,
        newThisMonth: clients.filter(c => {
            const firstDate = new Date(c.first_posting_date);
            return firstDate.getMonth() === thisMonth && firstDate.getFullYear() === thisYear;
        }).length,
        totalRevenue: clients.reduce((sum, c) => sum + c.total_spent, 0),
    };

    return { data: stats, error: null };
}
