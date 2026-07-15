import { AlertCircle, Inbox } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function ResourceLoading() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-40 rounded-xl" />)}</div>;
}

export function ResourceError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="mb-2 h-5 w-5" />
      <AlertTitle>Data belum dapat dimuat</AlertTitle>
      <AlertDescription>{message}. Pastikan migration WhatsApp Manager sudah dijalankan di Supabase.</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-8 text-center">
      <div className="mb-3 rounded-full bg-muted p-3"><Inbox className="h-6 w-6 text-muted-foreground" /></div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

