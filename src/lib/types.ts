// ============================================
// Biolink Types
// ============================================

export interface BiolinkProfile {
    id: string;
    avatar_url: string | null;
    username: string;
    display_name: string | null;
    bio: string | null;
    updated_at: string;
}

export interface BiolinkItem {
    id: string;
    type: "link" | "dropdown";
    icon: string;
    label: string;
    url?: string;
    order_index: number;
    is_active: boolean;
    created_at: string;
    dropdown_items?: DropdownItem[];
}

export interface DropdownItem {
    id: string;
    biolink_item_id: string;
    label: string;
    description?: string;
    url?: string;
    order_index: number;
}

// ============================================
// Invoice Types
// ============================================

export interface Invoice {
    id: string;
    number: string;
    date: string;
    due_date?: string;
    client_name: string;
    client_phone?: string;
    client_address?: string;
    notes?: string;
    status: "draft" | "sent" | "paid";
    total: number;
    created_at: string;
    items?: InvoiceItem[];
}

export interface InvoiceItem {
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    price: number;
    amount: number;
}

export interface InvoiceFormData {
    client_name: string;
    client_phone: string;
    client_address: string;
    date: string;
    due_date: string;
    notes: string;
    items: Omit<InvoiceItem, "id" | "invoice_id">[];
}

// ============================================
// Queue/Antri Types
// ============================================

export type QueueStatus = "draft" | "queued" | "posted" | "cancelled";

export interface PostingPackage {
    id: number;
    name: string;
    price: number;
    description?: string;
    is_popular: boolean;
    is_active: boolean;
    created_at?: string;
}

export interface PostingAddon {
    id: number;
    name: string;
    price: number;
    description?: string;
    is_active: boolean;
    created_at?: string;
}

export interface QueuePost {
    id: string;
    company_name: string;
    whatsapp_number: string;
    poster_url?: string;
    scheduled_date: string;
    scheduled_time: string;
    package_id: number;
    addons: number[];
    total_price: number;
    status: QueueStatus;
    notes?: string;
    transaction_id?: string;
    created_at: string;
    updated_at: string;
    // Joined data (optional)
    package?: PostingPackage;
    addon_details?: PostingAddon[];
}

export interface QueueColumn {
    id: QueueStatus;
    title: string;
    icon: string;
    color: string;
    posts: QueuePost[];
}

// ============================================
// Finance/Keuangan Types
// ============================================

export type TransactionType = "income" | "expense";
export type TransactionStatus = "pending" | "paid";
export type TransactionCategory = "posting" | "boost" | "promo" | "other";

export interface Transaction {
    id: string;
    type: TransactionType;
    amount: number;
    category: TransactionCategory;
    description?: string;
    client?: string;
    related_post_id?: string;
    related_invoice_id?: string;
    date: string;
    status: TransactionStatus;
    payment_method?: "transfer" | "cash" | "ewallet";
    notes?: string;
    created_at: string;
}

export interface FinanceSummary {
    total_income: number;
    monthly_income: number;
    transaction_count: number;
    average_per_post: number;
}

export interface MonthlyData {
    month: string;
    income: number;
    expense: number;
    posts: number;
}

// ============================================
// Client Database Types
// ============================================

export type ClientTier = "bronze" | "silver" | "gold" | "platinum";

export interface AggregatedClient {
    whatsapp_number: string;
    company_name: string;
    total_postings: number;
    total_spent: number;
    last_posting_date: string;
    first_posting_date: string;
    poster_gallery: string[];
    tier: ClientTier;
}

export interface ClientDetail extends AggregatedClient {
    posting_history: QueuePost[];
}

// ============================================
// Common Types
// ============================================

export interface User {
    id: string;
    email: string;
    created_at: string;
}

export interface ApiResponse<T> {
    data: T | null;
    error: string | null;
}
