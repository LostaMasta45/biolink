// ============================================
// WhatsApp Automation Types
// ============================================

/**
 * Identitas nomor WhatsApp yang terhubung ke KirimDev
 */
export interface WhatsAppAccount {
  /** Phone ID dari KirimDev (bukan nomor telepon) */
  phoneId: string;
  /** Nama label untuk identifikasi */
  label: string;
  /** Nomor telepon format internasional tanpa + (contoh: 6283122866975) */
  phoneNumber: string;
}

/**
 * Payload webhook yang dikirim KirimDev ke server kita
 * Referensi: https://docs.kirim.dev
 * 
 * Event yang kita subscribe:
 * - message.received  → Pesan masuk dari customer ATAU dari diri sendiri
 * - message.sent       → Pesan berhasil terkirim
 * - message.status     → Update status (delivered, read, dll)
 */
export interface KirimDevWebhookPayload {
  /** Event type dari KirimDev */
  event: 
    | 'message.received'
    | 'message.sent'
    | 'message.status'
    | 'message.revoked'
    | 'message.edited'
    | 'conversation.assigned'
    | 'conversation.closed'
    | 'contact.created'
    | 'contact.updated'
    | 'contact.identity_updated';

  /** Data pesan */
  data: {
    /** ID unik pesan */
    id: string;
    /** Nomor pengirim (format: 6281xxx) */
    from: string;
    /** Nomor penerima */
    to: string;
    /** Timestamp pesan */
    timestamp: number;
    /** Nama pengirim (push name dari WhatsApp) */
    pushName?: string;
    /** Chat ID (personal atau group) */
    chatId?: string;
    /** Phone ID akun WhatsApp yang menerima (dari KirimDev) */
    phoneId?: string;
    /** Konten pesan */
    message?: {
      type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contact';
      text?: string;
      caption?: string;
      mediaUrl?: string;
    };
    /** Status update (untuk event message.status) */
    status?: 'sent' | 'delivered' | 'read' | 'failed';
  };
}

/**
 * Definisi command yang bisa di-trigger via self-message
 */
export interface CommandDefinition {
  /** Nama command (contoh: !rekap) */
  name: string;
  /** Deskripsi singkat */
  description: string;
  /** Contoh penggunaan */
  usage: string;
  /** Apakah command aktif */
  enabled: boolean;
  /** Handler function */
  handler: (args: string[], context: CommandContext) => Promise<string>;
}

/**
 * Context yang diberikan ke setiap command handler
 */
export interface CommandContext {
  /** Nomor pengirim */
  senderPhone: string;
  /** Phone ID akun yang menerima pesan */
  receiverPhoneId: string;
  /** Label akun yang menerima */
  receiverLabel: string;
  /** Raw payload dari webhook */
  rawPayload: KirimDevWebhookPayload;
}

/**
 * Log aktivitas command yang dieksekusi
 */
export interface CommandLog {
  id?: string;
  command: string;
  args: string;
  phone_id: string;
  sender: string;
  status: 'success' | 'error';
  response_preview: string;
  error_message?: string;
  executed_at: string;
}

/**
 * Konfigurasi notifikasi otomatis
 */
export interface AutoNotifyConfig {
  /** Kirim notifikasi saat ada order baru */
  on_new_order: boolean;
  /** Kirim notifikasi saat pembayaran masuk */
  on_payment_received: boolean;
  /** Kirim notifikasi saat ada user baru register */
  on_new_user: boolean;
  /** Kirim notifikasi saat ada error di sistem */
  on_system_error: boolean;
  /** Kirim rekap harian otomatis */
  daily_recap_enabled: boolean;
  /** Jam kirim rekap harian (0-23) */
  daily_recap_hour: number;
  /** Kirim ke nomor mana (phone number) */
  notify_phone: string;
  /** Pakai phone ID mana untuk kirim */
  notify_via_phone_id: string;
}
