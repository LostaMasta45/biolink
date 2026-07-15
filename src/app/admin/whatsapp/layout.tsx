import { ManagerShell } from "@/components/whatsapp/manager-shell";

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return <ManagerShell>{children}</ManagerShell>;
}

