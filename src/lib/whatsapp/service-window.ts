export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ServiceWindowStatus =
  | { state: "active"; lastInboundAt: string; expiresAt: string; remainingMs: number }
  | { state: "expired"; lastInboundAt: string; expiresAt: string; overdueMs: number }
  | { state: "missing" }
  | { state: "invalid"; rawValue: string };

/** Accepts ISO dates as well as Unix timestamps returned by provider history APIs. */
export function normalizeProviderTimestamp(value?: string | number | null): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  const milliseconds = Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(raw)
    ? (numeric < 100_000_000_000 ? numeric * 1000 : numeric)
    : NaN;
  const time = Number.isFinite(milliseconds) ? milliseconds : Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/**
 * WhatsApp's customer-service window is exactly 24 elapsed hours after the
 * latest inbound message. The window is open while `now < expiresAt`.
 */
export function getServiceWindowStatus(lastInboundAt?: string | null, now = Date.now()): ServiceWindowStatus {
  if (!lastInboundAt) return { state: "missing" };
  const normalized = normalizeProviderTimestamp(lastInboundAt);
  if (!normalized) return { state: "invalid", rawValue: lastInboundAt };
  const inboundTime = new Date(normalized).getTime();
  const expiresTime = inboundTime + WHATSAPP_SERVICE_WINDOW_MS;
  const expiresAt = new Date(expiresTime).toISOString();
  if (now < expiresTime) {
    return { state: "active", lastInboundAt: normalized, expiresAt, remainingMs: expiresTime - now };
  }
  return { state: "expired", lastInboundAt: normalized, expiresAt, overdueMs: now - expiresTime };
}

export function formatServiceWindowTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value)).replace(/\./g, ":");
}

export function formatServiceWindowDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
}

export function describeServiceWindow(status: ServiceWindowStatus): string {
  if (status.state === "active") {
    return `Jendela layanan WhatsApp masih aktif hingga ${formatServiceWindowTime(status.expiresAt)} WIB (sisa ${formatServiceWindowDuration(status.remainingMs)}).`;
  }
  if (status.state === "expired") {
    return `Jendela layanan WhatsApp 24 jam berakhir pada ${formatServiceWindowTime(status.expiresAt)} WIB; pesan customer terakhir diterima ${formatServiceWindowTime(status.lastInboundAt)} WIB. Pesan teks tidak dikirim. Minta customer mengirim chat baru atau gunakan template resmi.`;
  }
  if (status.state === "invalid") {
    return "Jendela layanan WhatsApp tidak dapat dipastikan karena waktu pesan inbound tidak valid. Pesan teks tidak dikirim; lakukan sinkronisasi Inbox atau minta customer mengirim chat baru.";
  }
  return "Jendela layanan WhatsApp belum dapat dibuka karena belum ada pesan inbound dari customer. Pesan teks tidak dikirim; minta customer mengirim chat baru atau gunakan template resmi.";
}
