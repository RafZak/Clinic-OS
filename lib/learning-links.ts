import type { FrameworkKind } from "@/lib/frameworks";

/**
 * Le programme formation qui couvre chaque framework de scoring.
 * Audio Vente couvre les 10 étapes du framework consultation
 * (modules numérotés 1-9 + intro 0). Convaincre au téléphone
 * couvre les 6 étapes du framework appel entrant.
 */
const FRAMEWORK_PROGRAM_SLUG: Record<FrameworkKind, string> = {
  consultation: "audio-vente",
  phone_call: "convaincre-au-telephone",
};

export function programHrefForFramework(kind: FrameworkKind): string {
  return `/catalogue/${FRAMEWORK_PROGRAM_SLUG[kind]}`;
}

export function moduleHrefForStep(
  kind: FrameworkKind,
  stepNumber: number
): string {
  return `${programHrefForFramework(kind)}#module-${stepNumber}`;
}

export function programHrefBySlug(slug: string): string {
  return `/catalogue/${slug}`;
}
