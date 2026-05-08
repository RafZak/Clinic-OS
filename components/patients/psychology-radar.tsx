"use client";

import {
  PSY_AXES,
  PSY_AXIS_LABEL,
  PSY_AXIS_SHORT_LABEL,
  type PsyAxis,
  type PsyRadar,
} from "@/lib/psychology/axes";
import { cn } from "@/lib/utils";

type Layer = {
  key: string;
  radar: PsyRadar;
  color: string;
  fillOpacity: number;
  strokeWidth: number;
  dasharray?: string;
};

export type PsychologyRadarProps = {
  layers: Layer[];
  size?: number;
  className?: string;
  showLabels?: boolean;
};

/** Plus large horizontalement pour laisser de la place aux labels (« Influence entourage », etc). */
const VIEW_W = 440;
const VIEW_H = 360;
const CX = 220;
const CY = 180;
const R = 130;

const ANGLES: Record<PsyAxis, number> = {
  acceptance: -Math.PI / 2,
  motivation: -Math.PI / 2 + Math.PI / 3,
  trust: -Math.PI / 2 + (2 * Math.PI) / 3,
  decisionStage: -Math.PI / 2 + Math.PI,
  externalInfluence: -Math.PI / 2 + (4 * Math.PI) / 3,
  priceSensitivity: -Math.PI / 2 + (5 * Math.PI) / 3,
};

/**
 * IMPORTANT : ordre HORAIRE autour de l'hexagone (par angle croissant).
 * PSY_AXES définit un ordre sémantique qui n'est PAS l'ordre géométrique :
 * il alterne (top, top-right, lower-right, top-left, lower-left, bottom),
 * ce qui crée un polygone auto-intersectant en forme de "papillon" si on
 * itère dans cet ordre pour dessiner. On utilise cet array partout pour
 * les rendus géométriques (grid, fill, segments perimeter).
 */
const PSY_AXES_CLOCKWISE: PsyAxis[] = [
  "acceptance", // top, -π/2
  "motivation", // top-right, -π/2 + π/3
  "trust", // lower-right, -π/2 + 2π/3
  "decisionStage", // bottom, π/2
  "externalInfluence", // lower-left, -π/2 + 4π/3
  "priceSensitivity", // top-left, -π/2 + 5π/3
];

function pointFor(axis: PsyAxis, value01: number): [number, number] {
  const angle = ANGLES[axis];
  const x = CX + Math.cos(angle) * R * value01;
  const y = CY + Math.sin(angle) * R * value01;
  return [x, y];
}

/**
 * Path SVG du polygone fermé sur les axes SCORÉS uniquement.
 * Si un axe est null, on le saute — le polygone se ferme directement entre
 * les vertex scorés. Évite que la forme passe par le centre (problème du
 * "papillon" quand null = 0). Quand ce n'est pas un hexagone complet, le
 * caller dessine en pointillé pour signaler les données partielles.
 */
function radarToPolygon(radar: PsyRadar): string | null {
  const points: string[] = [];
  for (const axis of PSY_AXES) {
    const raw = radar[axis];
    if (raw === null) continue;
    const [x, y] = pointFor(axis, raw / 10);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  if (points.length < 3) return null;
  return points.join(" ");
}

function scoredAxesCount(radar: PsyRadar): number {
  return PSY_AXES.reduce((acc, a) => acc + (radar[a] !== null ? 1 : 0), 0);
}

function scoredAxes(radar: PsyRadar): Array<{ axis: PsyAxis; value01: number }> {
  const out: Array<{ axis: PsyAxis; value01: number }> = [];
  for (const axis of PSY_AXES) {
    const raw = radar[axis];
    if (raw !== null) out.push({ axis, value01: raw / 10 });
  }
  return out;
}

function gridPolygon(scale: number): string {
  return PSY_AXES_CLOCKWISE.map((axis) => {
    const [x, y] = pointFor(axis, scale);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function labelAnchor(x: number): "start" | "middle" | "end" {
  if (x < CX - 5) return "end";
  if (x > CX + 5) return "start";
  return "middle";
}

export function PsychologyRadar({
  layers,
  size = 320,
  className,
  showLabels = true,
}: PsychologyRadarProps) {
  const gridScales = [0.25, 0.5, 0.75, 1];

  // Détecter les axes au moins partiellement scorés sur l'union des layers
  const axisHasValue: Record<PsyAxis, boolean> = {
    acceptance: false,
    motivation: false,
    trust: false,
    priceSensitivity: false,
    externalInfluence: false,
    decisionStage: false,
  };
  for (const layer of layers) {
    for (const axis of PSY_AXES) {
      if (layer.radar[axis] !== null) axisHasValue[axis] = true;
    }
  }

  return (
    <svg
      role="img"
      aria-label="Profil psychologique patient"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={size}
      height={size * (VIEW_H / VIEW_W)}
      className={cn("block", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Hexagone de fond rempli — uniforme sur toute la surface du cadre.
          Le data layer ne rajoute PAS de fill quand le profil est partiel,
          pour ne pas créer d'asymétrie qui briserait l'identité hexagonale. */}
      <polygon
        points={gridPolygon(1)}
        fill="#FBE0E8"
        fillOpacity={0.7}
        stroke="none"
        aria-hidden="true"
      />

      {/* Grid hexagons concentriques INTÉRIEURS — sous les données. */}
      <g aria-hidden="true">
        {gridScales
          .filter((s) => s !== 1)
          .map((scale) => (
            <polygon
              key={`grid-${scale}`}
              points={gridPolygon(scale)}
              fill="none"
              stroke="#CBD5E1"
              strokeWidth={1}
            />
          ))}
      </g>

      {/* Axis lines — dimmed/dashed sur les axes non observés (union de tous les layers) */}
      <g aria-hidden="true">
        {PSY_AXES.map((axis) => {
          const [x, y] = pointFor(axis, 1);
          const observed = axisHasValue[axis];
          return (
            <line
              key={`axis-${axis}`}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={observed ? "#E5E7EB" : "#F3F4F6"}
              strokeWidth={1}
              strokeDasharray={observed ? undefined : "2 2"}
            />
          );
        })}
      </g>

      {/* Layers — pour chaque layer, on dessine :
            1. Un polygone de fond (fill) sur les 6 axes (null = bord extérieur de
               l'hexagone) → couvre toujours toute la surface, pas de zones blanches.
            2. 6 segments individuels formant la perimeter : solide entre 2 axes scorés,
               POINTILLÉ dès qu'un axe est null. Le pointillé indique "frame théorique,
               pas de mesure réelle ici". */}
      <g>
        {layers.map((layer) => {
          const partial = scoredAxesCount(layer.radar) < PSY_AXES.length;
          // Fill rendu UNIQUEMENT si profil complet (6/6) — sinon le fill asymétrique
          // créerait des "losanges + triangles vides" qui rendent le radar illisible.
          // Sur profil partiel, on n'affiche que les segments + dots, et le fond
          // hexagonal (rose uniforme) reste le visuel dominant.
          const fillPoints = partial
            ? null
            : PSY_AXES_CLOCKWISE.map((axis) => {
                const raw = layer.radar[axis];
                const v01 = raw === null ? 0 : raw / 10;
                const [x, y] = pointFor(axis, v01);
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              }).join(" ");

          // 6 segments : pour chaque paire d'axes adjacents (ordre horaire)
          const segments = PSY_AXES_CLOCKWISE.map((axisA, i) => {
            const axisB =
              PSY_AXES_CLOCKWISE[(i + 1) % PSY_AXES_CLOCKWISE.length];
            const rawA = layer.radar[axisA];
            const rawB = layer.radar[axisB];
            const aNull = rawA === null;
            const bNull = rawB === null;
            const v01A = aNull ? 1 : rawA / 10;
            const v01B = bNull ? 1 : rawB / 10;
            const [xA, yA] = pointFor(axisA, v01A);
            const [xB, yB] = pointFor(axisB, v01B);
            const dashed = aNull || bNull;
            return {
              key: `${layer.key}-${axisA}-${axisB}`,
              x1: xA,
              y1: yA,
              x2: xB,
              y2: yB,
              dashed,
            };
          });

          return (
            <g key={layer.key}>
              {fillPoints && (
                <polygon
                  points={fillPoints}
                  fill={layer.color}
                  fillOpacity={layer.fillOpacity}
                  stroke="none"
                />
              )}
              {segments.map((seg) => (
                <line
                  key={seg.key}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={seg.dashed ? "#A50534" : layer.color}
                  strokeWidth={layer.strokeWidth}
                  strokeDasharray={seg.dashed ? "6 4" : layer.dasharray}
                  strokeOpacity={seg.dashed ? 0.9 : 1}
                  strokeLinecap="round"
                />
              ))}
            </g>
          );
        })}
      </g>

      {/* Contour HEXAGONAL EXTÉRIEUR posé PAR-DESSUS les données — garantit que
          les 6 côtés du cadre sont toujours visibles, peu importe le profil.
          Évite l'impression "papillon" quand les données ne couvrent que certains côtés. */}
      <polygon
        points={gridPolygon(1)}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
        strokeLinejoin="round"
        aria-hidden="true"
      />

      {/* Dots aux vertex effectivement scorés — ancre visuelle sur les vraies données.
          Pour les couches multi-session, on ne dessine que les dots de la dernière couche
          (généralement le global ou la session la plus récente) afin de ne pas surcharger. */}
      {layers.length > 0 && (
        <g aria-hidden="true">
          {scoredAxes(layers[layers.length - 1].radar).map(({ axis, value01 }) => {
            const [x, y] = pointFor(axis, value01);
            const last = layers[layers.length - 1];
            return (
              <circle
                key={`dot-${axis}`}
                cx={x}
                cy={y}
                r={3.5}
                fill={last.color}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
      )}

      {/* Axis labels — courts sur le radar, complets en title (tooltip natif au hover SVG).
          Le <title> est wrappé dans un <g> parent pour éviter un mismatch d'hydratation
          quand on le met directement enfant de <text>. */}
      {showLabels && (
        <g>
          {PSY_AXES.map((axis) => {
            const [x, y] = pointFor(axis, 1.18);
            const observed = axisHasValue[axis];
            return (
              <g key={`label-${axis}`}>
                <title>
                  {PSY_AXIS_LABEL[axis]}
                  {observed ? "" : " — non observé"}
                </title>
                <text
                  x={x}
                  y={y}
                  textAnchor={labelAnchor(x)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={500}
                  fill={observed ? "#374151" : "#9CA3AF"}
                  fontStyle={observed ? "normal" : "italic"}
                >
                  {PSY_AXIS_SHORT_LABEL[axis]}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
