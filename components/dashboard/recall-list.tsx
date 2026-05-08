import { Phone, ArrowRight } from "lucide-react";
import Link from "next/link";
import { searchPatientsByTags } from "@/lib/psychology/queries";
import { ACTIONABLE_TAGS, PSY_TAG_ACTIONS } from "@/lib/psychology/actions";
import { PSY_TAG_LABEL, type PsyTag } from "@/lib/psychology/tags";

type RecallEntry = {
  patientId: string;
  patientLabel: string;
  topTag: PsyTag;
  topTags: PsyTag[];
  daysSince: number;
  action: { fr: string; en: string; priority: number };
};

type Props = {
  centerId?: string | null;
  locale?: "fr" | "en";
};

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

export async function RecallList({ centerId = null, locale = "fr" }: Props) {
  const candidates = await searchPatientsByTags({
    tags: [...ACTIONABLE_TAGS],
    requireConsent: true,
    centerId: centerId ?? undefined,
    daysSinceLastSession: 7,
  });

  const entries: RecallEntry[] = candidates
    .map<RecallEntry | null>((c) => {
      const sortedTags = (c.tags as PsyTag[])
        .filter((t) => t in PSY_TAG_ACTIONS)
        .sort(
          (a, b) =>
            PSY_TAG_ACTIONS[b].priority - PSY_TAG_ACTIONS[a].priority
        );
      const topTag = sortedTags[0];
      if (!topTag) return null;
      const days = daysSince(c.lastSessionAt);
      return {
        patientId: c.patientId,
        patientLabel: c.patientLabel,
        topTag,
        topTags: sortedTags.slice(0, 2),
        daysSince: days,
        action: PSY_TAG_ACTIONS[topTag],
      } satisfies RecallEntry;
    })
    .filter((e): e is RecallEntry => e !== null);

  if (entries.length === 0) return null;

  const visible = entries.slice(0, 5);
  const title =
    locale === "en" ? "Patients to follow up" : "Patients à recontacter";
  const cta = locale === "en" ? "View all" : "Voir tous";

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            {title} ({entries.length})
          </h2>
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {visible.map((e) => (
          <li key={e.patientId}>
            <Link
              href={`/patients/${e.patientId}`}
              className="group flex items-center justify-between rounded-md px-3 py-2 transition hover:bg-surface-muted"
            >
              <div>
                <p className="text-sm font-medium">{e.patientLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {e.topTags.map((t) => PSY_TAG_LABEL[t]).join(" · ")}
                  {" · "}
                  <span className="italic">
                    {locale === "en"
                      ? `${e.daysSince}d ago`
                      : `il y a ${e.daysSince}j`}
                  </span>
                </p>
                <p className="mt-1 text-xs text-brand">
                  → {locale === "en" ? e.action.en : e.action.fr}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ul>
      {entries.length > 5 && (
        <Link
          href="/admin/psychology"
          className="mt-3 block text-center text-xs text-brand hover:underline"
        >
          {cta} ({entries.length})
        </Link>
      )}
    </section>
  );
}
