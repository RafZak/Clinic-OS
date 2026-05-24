export const CARE_AXES = [
  "rapport",
  "pedagogy",
  "structure",
  "guidance",
  "followThrough",
  "adaptability",
] as const;
export type CareAxis = (typeof CARE_AXES)[number];

/** Score 0-100 par axe. null si non observé. */
export type CareRadar = Record<CareAxis, number | null>;

export type AxisRationale = { fr: string; en: string };

export type CareSnapshot = {
  practitionerId: string;
  radar: CareRadar;
  rationale: Partial<Record<CareAxis, AxisRationale>> | null;
  source: "ai" | "seed";
  sessionsCount: number;
  updatedAt: Date;
};

export type CareTier = "signature" | "solid" | "developing";

export function tierFor(score: number): CareTier {
  if (score >= 75) return "signature";
  if (score >= 50) return "solid";
  return "developing";
}
