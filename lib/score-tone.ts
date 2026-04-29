export type ScoreTone = "neutral" | "success" | "warning" | "danger";

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score == null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}
