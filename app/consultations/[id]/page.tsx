import { notFound } from "next/navigation";
import { getSessionById } from "@/lib/sessions";
import { LiveConsole } from "@/components/live/live-console";
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
    return <LiveConsole sessionId={id} kind="consultation" />;
  }
  return <ResultsShell session={session} />;
}
