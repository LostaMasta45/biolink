import { createClient } from "@/lib/supabase/client";
import type { InvoiceData, InvoiceItemData, Client, BankAccount } from "./invoice-types";

// ============================================
// INVOICE SERVICES
// ============================================

export async function saveInvoice(invoice: InvoiceData): Promise<{ data: InvoiceData | null; error: string | null }> {
    const supabase = createClient();

    try {
        // First, save the invoice
        const { data: invoiceResult, error: invoiceError } = await supabase
            .from("invoices")
            .upsert({
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                client_id: invoice.client_id,
                client_name: invoice.client_name,
                client_phone: invoice.client_phone,
                client_address: invoice.client_address,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date,
                subtotal: invoice.subtotal,
                discount_type: invoice.discount_type,
                discount_value: invoice.discount_value,
                discount_amount: invoice.discount_amount,
                tax_enabled: invoice.tax_enabled,
                tax_percent: invoice.tax_percent,
                tax_amount: invoice.tax_amount,
                total: invoice.total,
                bank_name: invoice.bank_name,
                bank_account_number: invoice.bank_account_number,
                bank_account_name: invoice.bank_account_name,
                template: invoice.template,
                status: invoice.status,
                notes: invoice.notes,
                terms: invoice.terms,
            })
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // Delete existing items and insert new ones
        if (invoiceResult?.id) {
            await supabase.from("invoice_items").delete().eq("invoice_id", invoiceResult.id);

            const itemsToInsert = invoice.items.map((item, index) => ({
                invoice_id: invoiceResult.id,
                description: item.description,
                quantity: item.quantity,
                price: item.price,
                sort_order: index,
            }));

            const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
            if (itemsError) throw itemsError;
        }

        return { data: { ...invoice, id: invoiceResult?.id }, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save invoice";
        return { data: null, error: errorMessage };
    }
}

export async function getInvoices(): Promise<{ data: InvoiceData[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("invoices")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch invoices";
        return { data: [], error: errorMessage };
    }
}

export async function getInvoiceById(id: string): Promise<{ data: InvoiceData | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data: invoice, error: invoiceError } = await supabase
            .from("invoices")
            .select("*")
            .eq("id", id)
            .single();

        if (invoiceError) throw invoiceError;

        const { data: items, error: itemsError } = await supabase
            .from("invoice_items")
            .select("*")
            .eq("invoice_id", id)
            .order("sort_order", { ascending: true });

        if (itemsError) throw itemsError;

        return {
            data: { ...invoice, items: items || [] } as InvoiceData,
            error: null
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch invoice";
        return { data: null, error: errorMessage };
    }
}

export async function deleteInvoice(id: string): Promise<{ error: string | null }> {
    const supabase = createClient();

    try {
        const { error } = await supabase.from("invoices").delete().eq("id", id);
        if (error) throw error;
        return { error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete invoice";
        return { error: errorMessage };
    }
}

// ============================================
// CLIENT SERVICES
// ============================================

export async function getClients(): Promise<{ data: Client[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("clients")
            .select("*")
            .order("name", { ascending: true });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch clients";
        return { data: [], error: errorMessage };
    }
}

export async function saveClient(client: Partial<Client>): Promise<{ data: Client | null; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("clients")
            .upsert(client)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save client";
        return { data: null, error: errorMessage };
    }
}

// ============================================
// BANK ACCOUNT SERVICES
// ============================================

export async function getBankAccounts(): Promise<{ data: BankAccount[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("bank_accounts")
            .select("*")
            .order("is_default", { ascending: false });

        if (error) throw error;
        return { data: data || [], error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch bank accounts";
        return { data: [], error: errorMessage };
    }
}
