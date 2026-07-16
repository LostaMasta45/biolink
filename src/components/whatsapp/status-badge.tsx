import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  connected: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  failed: "border-red-500/30 bg-red-500/10 text-red-500",
  disconnected: "border-red-500/30 bg-red-500/10 text-red-500",
  degraded: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  retry: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  pending: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  skipped: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  inactive: "border-border bg-muted text-muted-foreground",
  unchecked: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant="outline" className={cn("capitalize", styles[status] ?? styles.inactive)}>{label ?? status}</Badge>;
}
