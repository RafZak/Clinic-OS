import { notFound } from "next/navigation";
import { getSessionById } from "@/lib/sessions";
import { loadReplayBundle } from "@/lib/replay-loader";
import { LiveConsole } from "@/components/live/live-console";
import { ReplayConsole } from "@/components/live/replay-console";
import { ResultsShell } from "@/components/live/results-shell";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) notFound();
  if (session.kind !== "consultation") notFound();

  if (session.status === "in_progress") {
    if (session.source === "replay") {
      const bundle = await loadReplayBundle(id);
      if (!bundle) notFound();
      return (
        <ReplayConsole
          sessionId={id}
          kind="consultation"
          scriptLines={bundle.scriptLines}
          totalDurationMs={bundle.totalDurationMs}
          patientLabel={bundle.patientLabel}
        />
      );
    }
    return <LiveConsole sessionId={id} kind="consultation" />;
  }
  return <ResultsShell session={session} />;
}
