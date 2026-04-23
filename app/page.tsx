export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex h-2 w-2 rounded-full bg-brand" />
        <h1 className="text-4xl font-semibold tracking-tight">Clinic OS</h1>
        <p className="max-w-lg text-base text-muted-foreground">
          Setup J1 — Next.js, Tailwind et tokens Amplifon en place.
          Les 15 tables Supabase sont migrées. La démo se construit jour après jour.
        </p>
      </div>
      <div className="flex gap-3">
        <span className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-primary-foreground">
          Audioprothésiste
        </span>
        <span className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground">
          Assistant accueil
        </span>
      </div>
    </main>
  );
}
