import {
  Activity,
  Braces,
  ContactRound,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessagesSquare,
  MessageCircleReply,
  BellRing,
  Bot,
  Settings,
  Webhook,
} from "lucide-react";
import type { TemplateType } from "@/types/whatsapp-manager";

export const WHATSAPP_NAV_ITEMS = [
  { href: "/admin/whatsapp", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/whatsapp/inbox", label: "Inbox", icon: MessagesSquare },
  { href: "/admin/whatsapp/inbox/contacts", label: "Kontak", icon: ContactRound },
  { href: "/admin/whatsapp/flow-builder", label: "Flow Builder", icon: GitBranch },
  { href: "/admin/whatsapp/templates", label: "Pesan Tersimpan", icon: FileText },
  { href: "/admin/whatsapp/auto-reply", label: "Keyword Automation", icon: MessageCircleReply },
  { href: "/admin/whatsapp/notifications", label: "Notification Center", icon: BellRing },
  { href: "/admin/whatsapp/commands", label: "Bot Commands", icon: Bot },
  { href: "/admin/whatsapp/logs", label: "Logs", icon: Activity },
  { href: "/admin/whatsapp/webhook", label: "Webhook", icon: Webhook },
  { href: "/admin/whatsapp/settings", label: "Settings", icon: Settings },
] as const;

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  text: "Teks",
  image: "Gambar",
  video: "Video",
  audio: "Audio",
  document: "Dokumen",
  reply_button: "Tombol balasan",
  url_button: "Tombol URL",
  list: "Daftar pilihan",
  carousel: "Carousel",
};

export const TEMPLATE_TYPES = Object.entries(TEMPLATE_TYPE_LABELS).map(([value, label]) => ({
  value: value as TemplateType,
  label,
}));

export const DEFAULT_FLOW_NODES = [
  "Start",
  "Welcome",
  "Waiting Poster",
  "Poster Approved",
  "Send Pricelist",
  "Choose Package",
  "Offer PIN",
  "Payment",
  "Payment Success",
  "Ask Instagram",
  "Queue",
  "Done",
] as const;

export const AUTOMATION_TRIGGERS = [
  "Saat pesan masuk"
] as const;

export const AUTOMATION_ACTIONS = [
  "Kirim template",
  "Kirim quick reply"
] as const;

export const WEBHOOK_EVENTS = [
  "Incoming",
  "Outgoing",
  "Payment Success",
  "Payment Failed",
  "Delivered",
  "Read",
  "Retry",
] as const;

export const EMPTY_ICON = Braces;
