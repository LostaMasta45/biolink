import {
  Activity,
  Braces,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessageCircleReply,
  Settings,
  Webhook,
} from "lucide-react";
import type { TemplateType } from "@/types/whatsapp-manager";

export const WHATSAPP_NAV_ITEMS = [
  { href: "/admin/whatsapp", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/whatsapp/flow-builder", label: "Flow Builder", icon: GitBranch },
  { href: "/admin/whatsapp/templates", label: "Templates", icon: FileText },
  { href: "/admin/whatsapp/auto-reply", label: "Auto Reply", icon: MessageCircleReply },
  { href: "/admin/whatsapp/logs", label: "Logs", icon: Activity },
  { href: "/admin/whatsapp/webhook", label: "Webhook", icon: Webhook },
  { href: "/admin/whatsapp/settings", label: "Settings", icon: Settings },
] as const;

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  text: "Teks",
  image: "Gambar",
  video: "Video",
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
