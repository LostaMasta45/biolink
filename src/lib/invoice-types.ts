// Invoice Types for the complete invoice system

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";
export type DiscountType = "percent" | "nominal";
export type InvoiceTemplate = "modern" | "professional" | "creative" | "classic" | "elegant" | "dark";

export interface Client {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    company?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface BankAccount {
    id: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    is_default: boolean;
    created_at: string;
}

export interface InvoiceItemData {
    id: string;
    description: string;
    quantity: number;
    price: number;
    amount?: number;
    sort_order?: number;
}

export interface InvoiceData {
    id?: string;
    invoice_number: string;
    client_id?: string;

    // Client info
    client_name: string;
    client_phone?: string;
    client_address?: string;

    // Dates
    invoice_date: string;
    due_date?: string;

    // Items
    items: InvoiceItemData[];

    // Amounts
    subtotal: number;
    discount_type: DiscountType;
    discount_value: number;
    discount_amount: number;
    tax_enabled: boolean;
    tax_percent: number;
    tax_amount: number;
    total: number;

    // Bank Info
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;

    // Template & Status
    template: InvoiceTemplate;
    status: InvoiceStatus;

    // Notes
    notes?: string;
    terms?: string;

    // Metadata
    created_at?: string;
    updated_at?: string;
}

// Template configurations
export const INVOICE_TEMPLATES: { id: InvoiceTemplate; name: string; description: string }[] = [
    { id: "modern", name: "Modern Minimal", description: "Clean & simple with accent colors" },
    { id: "professional", name: "Professional", description: "Formal business layout" },
    { id: "creative", name: "Creative Gradient", description: "Colorful with gradient accents" },
    { id: "classic", name: "Classic", description: "Traditional invoice design" },
    { id: "elegant", name: "Elegant", description: "Sophisticated with subtle patterns" },
    { id: "dark", name: "Dark Mode", description: "Dark themed invoice" },
];

export const INVOICE_STATUSES: { id: InvoiceStatus; name: string; color: string }[] = [
    { id: "draft", name: "Draft", color: "bg-slate-500" },
    { id: "sent", name: "Terkirim", color: "bg-blue-500" },
    { id: "paid", name: "Lunas", color: "bg-emerald-500" },
    { id: "cancelled", name: "Dibatalkan", color: "bg-red-500" },
];
