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

function pointFor(axis: PsyAxis, value01: number): [number, number] {
  const angle = ANGLES[axis];
  const x = CX + Math.cos(angle) * R * value01;
  const y = CY + Math.sin(angle) * R * value01;
  return [x, y];
}

/**
 * Path SVG du polygone fermé sur les 6 axes. Null est traité comme 0 (au centre)
 * pour préserver la gestalt du radar. Les dots posés à part marqueront les
 * VRAIES mesures, et les labels d'axes null seront dimmed visuellement.
 */
function radarToPolygon(radar: PsyRadar): string {
  return PSY_AXES.map((axis) => {
    const raw = radar[axis];
    const v = raw === null ? 0 : raw / 10;
    const [x, y] = pointFor(axis, v);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

/** Renvoie la liste des axes effectivement scorés sur ce radar (pour dessiner les dots). */
function scoredAxes(radar: PsyRadar): Array<{ axis: PsyAxis; value01: number }> {
  const out: Array<{ axis: PsyAxis; value01: number }> = [];
  for (const axis of PSY_AXES) {
    const raw = radar[axis];
    if (raw !== null) out.push({ axis, value01: raw / 10 });
  }
  return out;
}

function gridPolygon(scale: number): string {
  return PSY_AXES.map((axis) => {
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
      {/* Grid hexagons */}
      <g aria-hidden="true">
        {gridScales.map((scale) => (
          <polygon
            key={`grid-${scale}`}
            points={gridPolygon(scale)}
            fill="none"
            stroke="#E5E7EB"
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

      {/* Layers (oldest first → most recent → global on top) — polygones fermés sur 6 axes */}
      <g>
        {layers.map((layer) => (
          <polygon
            key={layer.key}
            points={radarToPolygon(layer.radar)}
            fill={layer.color}
            fillOpacity={layer.fillOpacity}
            stroke={layer.color}
            strokeWidth={layer.strokeWidth}
            strokeDasharray={layer.dasharray}
            strokeLinejoin="round"
          />
        ))}
      </g>

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

      {/* Axis labels — courts sur le radar, complets en title (tooltip natif) */}
      {showLabels && (
        <g>
          {PSY_AXES.map((axis) => {
            const [x, y] = pointFor(axis, 1.18);
            const observed = axisHasValue[axis];
            return (
              <text
                key={`label-${axis}`}
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
                <title>
                  {PSY_AXIS_LABEL[axis]}
                  {observed ? "" : " — non observé"}
                </title>
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}
