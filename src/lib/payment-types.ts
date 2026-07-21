// ============================================
// Payment System Types
// ============================================

export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

// Payment order stored in Supabase
export interface PaymentOrder {
    id: string;
    order_id: string;

    // Customer Info
    customer_name: string;
    customer_whatsapp: string;
    customer_company: string;

    // Package & Add-ons
    package_id: number;
    package_name: string;
    addons: number[];
    addon_names: string[];

    // Amounts
    amount: number;
    total_amount: number | null;
    catalog_subtotal?: number | null;
    payable_amount?: number | null;
    price_snapshot?: Array<{
        code: string;
        name: string;
        quantity: number;
        unit_price: number;
        subtotal: number;
        kind: "package" | "addon";
    }>;
    public_token?: string | null;
    upload_token?: string | null;
    related_invoice_id?: string | null;
    poster_status?: "pending" | "uploaded" | "deferred";

    // QRIS Data
    qris_url: string | null;
    qris_image: string | null;
    direct_url: string | null;
    signature: string | null;

    // Status
    status: PaymentStatus;
    expired_at: string | null;
    paid_at: string | null;

    // Integration sync flags
    synced_to_finance: boolean;
    synced_to_posting: boolean;
    related_transaction_id: string | null;
    related_posting_id: string | null;

    // Notes
    keterangan: string | null;

    // Timestamps
    created_at: string;
    updated_at: string;
}

// ============================================
// Package & Add-on Configs (hardcoded pricelist)
// ============================================

export interface PaymentPackageConfig {
    id: number;
    name: string;
    shortName: string;
    originalPrice?: number;
    price: number;
    description: string;
    features: string[];
    isPopular: boolean;
    isAvailable?: boolean;
    emoji: string;
    gradient: string;
}

export interface PaymentAddonConfig {
    id: number;
    name: string;
    price: number;
    description: string;
    emoji: string;
}

// Pricelist paket utama
export const PAYMENT_PACKAGES: PaymentPackageConfig[] = [
    {
        id: 99,
        name: "Paket Uji Coba (Test)",
        shortName: "Test 1k",
        price: 1000,
        description: "Paket khusus untuk testing flow pembayaran",
        features: [
            "Test create order",
            "Test generate QRIS",
            "Test webhook otomatis",
        ],
        isPopular: false,
        isAvailable: true,
        emoji: "🧪",
        gradient: "from-gray-500 to-slate-500",
    },
    {
        id: 1,
        name: "Paket Feed IG",
        shortName: "Feed IG",
        price: 75000,
        description: "Postingan feed Instagram selamanya",
        features: [
            "Posting di Feed IG",
            "Selamanya (tidak dihapus)",
            "Desain poster menarik",
        ],
        isPopular: false,
        emoji: "📸",
        gradient: "from-blue-500 to-cyan-500",
    },
    {
        id: 2,
        name: "Paket Story IG",
        shortName: "Story IG",
        price: 45000,
        description: "Story Instagram tanpa feed",
        features: [
            "Posting di Story IG",
            "Durasi 24 jam",
            "Jangkauan luas",
        ],
        isPopular: false,
        emoji: "⏳",
        gradient: "from-purple-500 to-pink-500",
    },
    {
        id: 3,
        name: "Paket Feed & Story + Bonus",
        shortName: "Feed & Story",
        price: 90000,
        description: "Feed + Story + BONUS share ke semua platform",
        features: [
            "Posting di Feed IG (selamanya)",
            "Posting di Story IG",
            "FREE Share ke Saluran WA",
            "FREE Share ke Grup Telegram",
            "FREE Share ke Threads",
        ],
        isPopular: true,
        emoji: "🔥",
        gradient: "from-orange-500 to-red-500",
    },
];

// Add-on tambahan
export const PAYMENT_ADDONS: PaymentAddonConfig[] = [
    {
        id: 1,
        name: "Saluran WA, Threads, Grup Telegram",
        price: 50000,
        description: "Share ke Saluran WA, Threads & Grup Telegram",
        emoji: "📢",
    },
    {
        id: 2,
        name: "2 Grub FB (270K+ Anggota)",
        price: 40000,
        description: "Share ke 2 grup Facebook dengan 270.000+ anggota",
        emoji: "👥",
    },
    {
        id: 3,
        name: "PIN Postingan 3 Hari",
        price: 35000,
        description: "Postingan di-pin selama 3 hari",
        emoji: "📌",
    },
    {
        id: 4,
        name: "PIN Postingan 7 Hari",
        price: 45000,
        description: "Postingan di-pin selama 7 hari",
        emoji: "📌",
    },
    {
        id: 5,
        name: "Pasang di Sorotan 7 Hari",
        price: 20000,
        description: "Tampil di highlight/sorotan selama 7 hari",
        emoji: "⭐",
    },
    {
        id: 6,
        name: "Link Swipe Up",
        price: 20000,
        description: "Tambahkan link swipe up di story",
        emoji: "🔗",
    },
    {
        id: 7,
        name: "Saluran IG",
        price: 40000,
        description: "Share ke Saluran IG (broadcast channel)",
        emoji: "📡",
    },
    {
        id: 8,
        name: "Jasa Desain Poster Loker",
        price: 25000,
        description: "Desain poster lowongan kerja profesional",
        emoji: "🎨",
    },
];

// ============================================
// API Request/Response Types
// ============================================

export interface CreatePaymentRequest {
    customer_name: string;
    customer_whatsapp: string;
    customer_company: string;
    package_id: number;
    addons: number[];
    idempotency_key: string;
}

export interface CreatePaymentResponse {
    success: boolean;
    data?: {
        order_id: string;
        amount: number;
        total_amount: number;
        qris_url: string | null;
        qris_image: string | null;
        direct_url: string | null;
        signature: string;
        expired_at: string;
        package_name: string;
        addon_names: string[];
        public_token?: string;
        upload_token?: string;
    };
    error?: string;
}

export interface PaymentStatusResponse {
    success: boolean;
    data?: {
        order_id: string;
        status: PaymentStatus;
        total_amount: number;
        paid_at: string | null;
        expired_at: string | null;
    };
    error?: string;
}

// KlikQRIS API Response types
export interface KlikQRISCreateResponse {
    status: boolean;
    message: string;
    data: {
        order_id: string;
        amount: string;
        total_amount: string;
        status: string;
        direct_url: string;
        qris_url: string;
        expired_at: string;
        signature: string;
        qris_image?: string;
    };
}

export interface KlikQRISStatusResponse {
    status: boolean;
    data: {
        order_id: string;
        status: string;
        total_amount: number;
        paid_at?: string;
        expired_at?: string;
    };
}

export interface KlikQRISWebhookPayload {
    status: string;
    message: string;
    data: {
        order_id: string;
        amount_request: number;
        amount_paid: number;
        payment_date: string;
        status: string;
        merchant_id: string;
        via: string;
        signature: string;
    };
}

// ============================================
// Payment Stats (for admin)
// ============================================

export interface PaymentStats {
    total_revenue: number;
    today_revenue: number;
    pending_count: number;
    paid_count: number;
    expired_count: number;
    total_count: number;
}
