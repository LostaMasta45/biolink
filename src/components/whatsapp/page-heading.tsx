import type { LucideIcon } from "lucide-react";

interface PageHeadingProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}

export function PageHeading({ title, description, icon: Icon, action }: PageHeadingProps) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

