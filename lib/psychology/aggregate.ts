import { PSY_AXES, type PsyAxis, type PsyRadar, type PsySnapshot } from "./axes";
import { computeTags, type PsyTag } from "./tags";

/**
 * Calcule le radar global d'un patient depuis tous ses snapshots de session.
 * Règle : pour chaque axe, on prend la valeur non-null la plus récente parmi
 * tous les snapshots du patient (cf. spec §6.3).
 * Si aucun snapshot n'a une valeur observée pour l'axe, l'axe global reste null.
 */
export function computeGlobalRadar(snapshots: PsySnapshot[]): PsyRadar {
  const ordered = [...snapshots].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const radar = {} as PsyRadar;
  for (const axis of PSY_AXES) {
    const found = ordered.find(
      (s) => s.radar[axis] !== null && s.radar[axis] !== undefined
    );
    radar[axis] = found?.radar[axis] ?? null;
  }
  return radar;
}

/**
 * Trouve le snapshot source d'un axe pour le radar global. Utilisé pour le
 * tooltip de hover (afficher la rationale + citation issues du bon snapshot).
 */
export function findSnapshotForAxis(
  axis: PsyAxis,
  snapshots: PsySnapshot[]
): PsySnapshot | null {
  const ordered = [...snapshots].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return (
    ordered.find(
      (s) => s.radar[axis] !== null && s.radar[axis] !== undefined
    ) ?? null
  );
}

/**
 * Tags du global = recalculés depuis le radar global agrégé (pas la
 * concaténation des tags individuels). Garantit cohérence avec l'affichage
 * et l'export marketing.
 */
export function computeGlobalTags(snapshots: PsySnapshot[]): PsyTag[] {
  return computeTags(computeGlobalRadar(snapshots));
}
