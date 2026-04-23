export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function PlaceholderBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted-foreground">
      {children}
    </div>
  );
}
