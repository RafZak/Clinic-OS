"use client";

import {
  PSY_AXES,
  PSY_AXIS_LABEL,
  PSY_AXIS_POLARITY,
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

      {/* Polygone des données — fermé UNIQUEMENT sur les axes scorés (skip null).
          Lecture simple : la zone colorée correspond aux dimensions mesurées, l'espace
          hexagonal restant montre les dimensions non observées. Le grid hexagonal en
          fond reste le cadre. */}
      <g>
        {layers.map((layer) => {
          const points = PSY_AXES_CLOCKWISE
            .filter((axis) => layer.radar[axis] !== null)
            .map((axis) => {
              const v01 = (layer.radar[axis] as number) / 10;
              const [x, y] = pointFor(axis, v01);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ");
          if (!points || points.split(" ").length < 3) return null;
          return (
            <polygon
              key={layer.key}
              points={points}
              fill={layer.color}
              fillOpacity={layer.fillOpacity}
              stroke={layer.color}
              strokeWidth={layer.strokeWidth}
              strokeDasharray={layer.dasharray}
              strokeLinejoin="round"
            />
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

      {/* Dots aux vertex effectivement scorés + valeur affichée à côté.
          Multi-session : seulement la dernière couche (sinon trop chargé). */}
      {layers.length > 0 && (
        <g>
          {scoredAxes(layers[layers.length - 1].radar).map(({ axis, value01 }) => {
            const [x, y] = pointFor(axis, value01);
            const score = Math.round(value01 * 10);
            const last = layers[layers.length - 1];
            // Position du label valeur : légèrement décalé vers l'extérieur
            const [lx, ly] = pointFor(axis, Math.min(value01 + 0.12, 1.05));
            return (
              <g key={`dot-${axis}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={last.color}
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9.5}
                  fontWeight={700}
                  fill={last.color}
                  paintOrder="stroke"
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {score}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Axis labels — courts + indicateur de polarité (+/−) pour lever l'ambiguïté
          de lecture. Tooltip natif explicite au hover.
          - "+" = haut sur le radar = signal favorable (acceptation, motivation, …)
          - "−" = haut = signal défavorable / friction (sensibilité prix, dépendance) */}
      {showLabels && (
        <g>
          {PSY_AXES.map((axis) => {
            const [x, y] = pointFor(axis, 1.18);
            const observed = axisHasValue[axis];
            const polarity = PSY_AXIS_POLARITY[axis];
            const polaritySymbol = polarity === "positive" ? "+" : "−";
            const polarityHint =
              polarity === "positive"
                ? "haut = favorable"
                : "haut = point de friction";
            return (
              <g key={`label-${axis}`}>
                <title>
                  {PSY_AXIS_LABEL[axis]} ({polarityHint})
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
                  {PSY_AXIS_SHORT_LABEL[axis]}{" "}
                  <tspan
                    fontSize={9}
                    fontWeight={600}
                    fill={polarity === "positive" ? "#16A34A" : "#B91C1C"}
                  >
                    {polaritySymbol}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
