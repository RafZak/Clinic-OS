import {
  CARE_AXES,
  type CareAxis,
  type CareRadar,
  type CareSnapshot,
  type CareTier,
  tierFor,
} from "./types";

/** Moyenne par axe sur les snapshots ayant une valeur (arrondie). null si aucun. */
export function computeTeamAverage(snaps: CareSnapshot[]): CareRadar {
  const radar = {} as CareRadar;
  for (const axis of CARE_AXES) {
    const vals = snaps
      .map((s) => s.radar[axis])
      .filter((v): v is number => v !== null);
    radar[axis] = vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : null;
  }
  return radar;
}

/** Distribution par axe : nombre de cliniciens par palier (jamais qui). */
export function computeDistribution(
  snaps: CareSnapshot[]
): Record<CareAxis, Record<CareTier, number>> {
  const out = {} as Record<CareAxis, Record<CareTier, number>>;
  for (const axis of CARE_AXES) {
    const d: Record<CareTier, number> = {
      signature: 0,
      solid: 0,
      developing: 0,
    };
    for (const s of snaps) {
      const v = s.radar[axis];
      if (v !== null) d[tierFor(v)] += 1;
    }
    out[axis] = d;
  }
  return out;
}
