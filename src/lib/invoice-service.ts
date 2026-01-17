import { createClient } from "@/lib/supabase/client";
import type { InvoiceData, InvoiceItemData, Client, BankAccount } from "./invoice-types";
import { formatInvoiceMessage, sendTelegramMessage } from "./telegram-service";

// ============================================
// INVOICE SERVICES
// ============================================

export async function saveInvoice(invoice: InvoiceData): Promise<{ data: InvoiceData | null; error: string | null }> {
    const supabase = createClient();
    const isUpdate = !!invoice.id;

    try {
        // Build the invoice payload - only include id if it exists (for updates)
        // This allows Supabase to auto-generate a new UUID for new invoices
        const invoicePayload: Record<string, unknown> = {
            invoice_number: invoice.invoice_number,
            client_id: invoice.client_id,
            client_name: invoice.client_name,
            client_phone: invoice.client_phone,
            client_address: invoice.client_address,
            sender_name: invoice.sender_name,
            sender_address: invoice.sender_address,
            sender_contact: invoice.sender_contact,
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
            color_theme: invoice.color_theme,
            status: invoice.status,
            notes: invoice.notes,
            terms: invoice.terms,
            logo_url: invoice.logo_url,
        };

        // Only include id for updates to avoid conflicts when creating new invoices
        if (isUpdate && invoice.id) {
            invoicePayload.id = invoice.id;
        }

        // Save the invoice - use insert for new, upsert for updates
        const { data: invoiceResult, error: invoiceError } = isUpdate
            ? await supabase
                .from("invoices")
                .upsert(invoicePayload)
                .select()
                .single()
            : await supabase
                .from("invoices")
                .insert(invoicePayload)
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

        // Send Telegram Notification
        try {
            const message = formatInvoiceMessage({ ...invoice, id: invoiceResult?.id }, isUpdate);
            await sendTelegramMessage(message);
        } catch (err) {
            console.error("Failed to send telegram notification for invoice", err);
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

// ============================================
// LOGO STORAGE SERVICES
// ============================================

export async function uploadInvoiceLogo(file: File): Promise<{ url: string | null; error: string | null }> {
    const supabase = createClient();

    try {
        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `logo-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("invoice-logos")
            .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from("invoice-logos")
            .getPublicUrl(fileName);

        return { url: publicUrl, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to upload logo";
        return { url: null, error: errorMessage };
    }
}

export async function getInvoiceLogos(): Promise<{ data: string[]; error: string | null }> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.storage
            .from("invoice-logos")
            .list("", {
                limit: 50,
                sortBy: { column: "created_at", order: "desc" },
            });

        if (error) throw error;

        // Build public URLs for each file
        const urls = (data || [])
            .filter((file: { name: string }) => file.name && !file.name.startsWith("."))
            .map((file: { name: string }) => {
                const { data: { publicUrl } } = supabase.storage
                    .from("invoice-logos")
                    .getPublicUrl(file.name);
                return publicUrl;
            });

        return { data: urls, error: null };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch logos";
        return { data: [], error: errorMessage };
    }
}
