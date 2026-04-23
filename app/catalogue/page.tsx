import { PageHeader } from "@/components/layout/page-header";
import { ProgramCard } from "@/components/catalogue/program-card";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  getProgramChunkStats,
  listPrograms,
  type ProgramCategory,
} from "@/lib/programs";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const [programs, stats] = await Promise.all([
    listPrograms(),
    getProgramChunkStats(),
  ]);

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABEL[cat],
    programs: programs.filter((p) => (p.category as ProgramCategory) === cat),
  })).filter((section) => section.programs.length > 0);

  const activeCount = programs.filter((p) => p.isAvailable).length;
  const totalCount = programs.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Catalogue de formation"
        description={`${activeCount} programme${activeCount > 1 ? "s" : ""} actif${
          activeCount > 1 ? "s" : ""
        } · ${totalCount - activeCount} à venir. Conçus par Audio Académie, ingérés dans Clinic OS pour servir la recherche Cmd+K et le coaching des consultations.`}
      />

      <div className="flex flex-col gap-10">
        {byCategory.map((section) => (
          <section key={section.category} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {section.label}
              </h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {section.programs.filter((p) => p.isAvailable).length}/
                {section.programs.length} disponibles
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.programs.map((p) => {
                const s = stats.get(p.slug);
                return (
                  <ProgramCard
                    key={p.slug}
                    slug={p.slug}
                    title={p.title}
                    description={p.description}
                    icon={p.icon}
                    isAvailable={p.isAvailable ?? false}
                    chunkCount={s?.chunks}
                    fileCount={s?.files}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
