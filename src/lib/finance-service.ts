"use client";

import { createClient } from "@/lib/supabase/client";
import type {
    Transaction,
    TransactionMode,
    TransactionType,
    TransactionCategory,
    FinanceDashboard,
    TransactionStatus
} from "@/lib/types";
import { formatTransactionMessage, sendTelegramMessage } from "./telegram-service";

// ============================================
// Types for filters
// ============================================

export interface TransactionFilters {
    mode?: TransactionMode | "all";
    type?: TransactionType | "all";
    status?: TransactionStatus | "all";
    category?: TransactionCategory | "all";
    dateFrom?: string;
    dateTo?: string;
    search?: string;
}

// ============================================
// Fetch Functions
// ============================================

export async function getTransactions(
    filters: TransactionFilters = {}
): Promise<{ data: Transaction[]; error: string | null }> {
    const supabase = createClient();

    try {
        let query = supabase
            .from("transactions")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false });

        // Apply filters
        if (filters.mode && filters.mode !== "all") {
            query = query.eq("mode", filters.mode);
        }
        if (filters.type && filters.type !== "all") {
            query = query.eq("type", filters.type);
        }
        if (filters.status && filters.status !== "all") {
            query = query.eq("status", filters.status);
        }
        if (filters.category && filters.category !== "all") {
            query = query.eq("category", filters.category);
        }
        if (filters.dateFrom) {
            query = query.gte("date", filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.lte("date", filters.dateTo);
        }
        if (filters.search) {
            query = query.or(`description.ilike.%${filters.search}%,client.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch transactions";
        return { data: [], error: errorMessage };
    }
}

export async function getFinanceDashboard(): Promise<{ data: FinanceDashboard | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data: transactions, error } = await supabase
            .from("transactions")
            .select("*");

        if (error) throw error;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const dashboard: FinanceDashboard = {
            total_balance: 0,
            business_income: 0,
            business_expense: 0,
            business_balance: 0,
            personal_income: 0,
            personal_expense: 0,
            personal_balance: 0,
            pending_amount: 0,
            monthly_income: 0,
            monthly_expense: 0,
        };

        (transactions || []).forEach((t: Transaction) => {
            const txDate = new Date(t.date);
            const isCurrentMonth = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
            const isPaid = t.status === "paid";

            if (t.mode === "business") {
                if (t.type === "income") {
                    if (isPaid) dashboard.business_income += t.amount;
                    if (isCurrentMonth && isPaid) dashboard.monthly_income += t.amount;
                } else {
                    if (isPaid) dashboard.business_expense += t.amount;
                    if (isCurrentMonth && isPaid) dashboard.monthly_expense += t.amount;
                }
            } else {
                if (t.type === "income") {
                    if (isPaid) dashboard.personal_income += t.amount;
                    if (isCurrentMonth && isPaid) dashboard.monthly_income += t.amount;
                } else {
                    if (isPaid) dashboard.personal_expense += t.amount;
                    if (isCurrentMonth && isPaid) dashboard.monthly_expense += t.amount;
                }
            }

            if (t.status === "pending") {
                dashboard.pending_amount += t.amount;
            }
        });

        dashboard.business_balance = dashboard.business_income - dashboard.business_expense;
        dashboard.personal_balance = dashboard.personal_income - dashboard.personal_expense;
        dashboard.total_balance = dashboard.business_balance + dashboard.personal_balance;

        return { data: dashboard, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch dashboard";
        return { data: null, error: errorMessage };
    }
}

export async function getMonthlyData(
    months: number = 6
): Promise<{ data: { month: string; income: number; expense: number }[]; error: string | null }> {
    const supabase = createClient();

    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months + 1);
        startDate.setDate(1);

        const { data: transactions, error } = await supabase
            .from("transactions")
            .select("*")
            .gte("date", startDate.toISOString().split("T")[0])
            .lte("date", endDate.toISOString().split("T")[0])
            .eq("status", "paid");

        if (error) throw error;

        // Group by month
        const monthlyMap = new Map<string, { income: number; expense: number }>();

        // Initialize all months
        for (let i = 0; i < months; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toLocaleDateString("id-ID", { month: "short" });
            monthlyMap.set(key, { income: 0, expense: 0 });
        }

        (transactions || []).forEach((t: Transaction) => {
            const txDate = new Date(t.date);
            const key = txDate.toLocaleDateString("id-ID", { month: "short" });
            const current = monthlyMap.get(key) || { income: 0, expense: 0 };

            if (t.type === "income") {
                current.income += t.amount;
            } else {
                current.expense += t.amount;
            }
            monthlyMap.set(key, current);
        });

        const result = Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, ...data }))
            .reverse();

        return { data: result, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch monthly data";
        return { data: [], error: errorMessage };
    }
}

// ============================================
// CRUD Functions
// ============================================

export async function createTransaction(
    transaction: Omit<Transaction, "id" | "created_at" | "updated_at">
): Promise<{ data: Transaction | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("transactions")
            .insert(transaction)
            .select()
            .single();

        if (error) throw error;

        // Send Telegram Notification
        try {
            const message = formatTransactionMessage(data);
            await sendTelegramMessage(message);
        } catch (err) {
            console.error("Failed to send telegram notification", err);
        }

        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create transaction";
        return { data: null, error: errorMessage };
    }
}

export async function updateTransaction(
    id: string,
    transaction: Partial<Transaction>
): Promise<{ data: Transaction | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("transactions")
            .update({ ...transaction, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update transaction";
        return { data: null, error: errorMessage };
    }
}

export async function deleteTransaction(
    id: string
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return { success: true, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete transaction";
        return { success: false, error: errorMessage };
    }
}

// ============================================
// Sync from Posting (Antri)
// ============================================

export async function syncPostingToTransaction(posting: {
    id: string;
    company_name: string;
    total_price: number;
    scheduled_date: string;
}): Promise<{ data: Transaction | null; error: string | null }> {
    const supabase = createClient();

    try {
        // Check if already synced
        const { data: existing } = await supabase
            .from("transactions")
            .select("id")
            .eq("related_post_id", posting.id)
            .single();

        if (existing) {
            return { data: null, error: null }; // Already synced
        }

        // Create new transaction
        const { data, error } = await supabase
            .from("transactions")
            .insert({
                mode: "business",
                type: "income",
                amount: posting.total_price,
                category: "posting",
                description: `Posting loker - ${posting.company_name}`,
                client: posting.company_name,
                related_post_id: posting.id,
                date: posting.scheduled_date,
                status: "paid",
            })
            .select()
            .single();

        if (error) throw error;

        // Send Telegram Notification
        try {
            const message = formatTransactionMessage(data);
            await sendTelegramMessage(message);
        } catch (err) {
            console.error("Failed to send telegram notification", err);
        }

        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to sync posting";
        return { data: null, error: errorMessage };
    }
}

// ============================================
// Helper Functions
// ============================================

export function formatRupiahShort(amount: number): string {
    if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}jt`;
    } else if (amount >= 1000) {
        return `${(amount / 1000).toFixed(0)}rb`;
    }
    return amount.toString();
}

export function getCategoryIcon(category: TransactionCategory): string {
    const icons: Record<TransactionCategory, string> = {
        // Business Income
        posting: "📝",
        boost: "🚀",
        sponsor: "🤝",
        other_income: "💰",
        // Business Expense
        internet: "🌐",
        hosting: "🖥️",
        marketing: "📢",
        tools: "🛠️",
        other_biz: "💼",
        // Personal Income
        salary: "💵",
        freelance: "💻",
        gift: "🎁",
        investment: "📈",
        other_personal_income: "💸",
        // Personal Expense
        food: "🍔",
        transport: "🚗",
        shopping: "🛒",
        bills: "💡",
        health: "💊",
        entertainment: "🎮",
        other: "📦",
    };
    return icons[category] || "📦";
}

export function getCategoryLabel(category: TransactionCategory): string {
    const labels: Record<TransactionCategory, string> = {
        // Business Income
        posting: "Posting Loker",
        boost: "Boost",
        sponsor: "Sponsor",
        other_income: "Lainnya",
        // Business Expense
        internet: "Internet",
        hosting: "Hosting",
        marketing: "Marketing",
        tools: "Tools",
        other_biz: "Bisnis Lain",
        // Personal Income
        salary: "Gaji",
        freelance: "Freelance",
        gift: "Hadiah",
        investment: "Investasi",
        other_personal_income: "Lainnya",
        // Personal Expense
        food: "Makan",
        transport: "Transport",
        shopping: "Belanja",
        bills: "Tagihan",
        health: "Kesehatan",
        entertainment: "Hiburan",
        other: "Lainnya",
    };
    return labels[category] || category;
}
