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
    gallery?: string[]; // Virtual field for UI
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

export type TransactionMode = "business" | "personal";
export type TransactionType = "income" | "expense";
export type TransactionStatus = "pending" | "paid";

// Business income categories
export type BusinessIncomeCategory = "posting" | "boost" | "sponsor" | "other_income";

// Business expense categories  
export type BusinessExpenseCategory = "internet" | "hosting" | "marketing" | "tools" | "other_biz";

// Personal income categories
export type PersonalIncomeCategory = "salary" | "freelance" | "gift" | "investment" | "other_personal_income";

// Personal expense categories
export type PersonalExpenseCategory = "food" | "transport" | "shopping" | "bills" | "health" | "entertainment" | "other";

// Combined category type
export type TransactionCategory = string;

export interface Transaction {
    id: string;
    mode: TransactionMode;
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
    updated_at?: string;
}

export interface FinanceDashboard {
    total_balance: number;
    business_income: number;
    business_expense: number;
    business_balance: number;
    personal_income: number;
    personal_expense: number;
    personal_balance: number;
    pending_amount: number;
    monthly_income: number;
    monthly_expense: number;
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

// Category display helpers
export const CATEGORY_CONFIG: Record<TransactionCategory, { label: string; icon: string; color: string }> = {
    // Business Income
    posting: { label: "Posting Loker", icon: "📝", color: "violet" },
    boost: { label: "Boost", icon: "🚀", color: "violet" },
    sponsor: { label: "Sponsor", icon: "🤝", color: "violet" },
    other_income: { label: "Lainnya", icon: "💰", color: "violet" },
    // Business Expense
    internet: { label: "Internet", icon: "🌐", color: "purple" },
    hosting: { label: "Hosting", icon: "🖥️", color: "purple" },
    marketing: { label: "Marketing", icon: "📢", color: "purple" },
    tools: { label: "Tools", icon: "🛠️", color: "purple" },
    other_biz: { label: "Bisnis Lain", icon: "💼", color: "purple" },
    // Personal Income
    salary: { label: "Gaji", icon: "💵", color: "teal" },
    freelance: { label: "Freelance", icon: "💻", color: "teal" },
    gift: { label: "Hadiah", icon: "🎁", color: "teal" },
    investment: { label: "Investasi", icon: "📈", color: "teal" },
    other_personal_income: { label: "Lainnya", icon: "💸", color: "teal" },
    // Personal Expense
    food: { label: "Makan", icon: "🍔", color: "emerald" },
    transport: { label: "Transport", icon: "🚗", color: "emerald" },
    shopping: { label: "Belanja", icon: "🛒", color: "emerald" },
    bills: { label: "Tagihan", icon: "💡", color: "emerald" },
    health: { label: "Kesehatan", icon: "💊", color: "emerald" },
    entertainment: { label: "Hiburan", icon: "🎮", color: "emerald" },
    other: { label: "Lainnya", icon: "📦", color: "emerald" },
};

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
