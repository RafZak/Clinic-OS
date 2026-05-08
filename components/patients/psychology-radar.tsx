"use client";

import {
  PSY_AXES,
  PSY_AXIS_LABEL,
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

const VIEW = 360;
const CX = 180;
const CY = 180;
const R = 140;

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

function radarToPolygon(radar: PsyRadar): string {
  return PSY_AXES.map((axis) => {
    const raw = radar[axis];
    const v = raw === null ? 0 : raw / 10;
    const [x, y] = pointFor(axis, v);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
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

  return (
    <svg
      role="img"
      aria-label="Profil psychologique patient"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      className={cn("block", className)}
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

      {/* Axis lines */}
      <g aria-hidden="true">
        {PSY_AXES.map((axis) => {
          const [x, y] = pointFor(axis, 1);
          return (
            <line
              key={`axis-${axis}`}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={1}
            />
          );
        })}
      </g>

      {/* Layers (oldest first → most recent → global on top) */}
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

      {/* Axis labels */}
      {showLabels && (
        <g>
          {PSY_AXES.map((axis) => {
            const [x, y] = pointFor(axis, 1.15);
            return (
              <text
                key={`label-${axis}`}
                x={x}
                y={y}
                textAnchor={labelAnchor(x)}
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={500}
                fill="#374151"
              >
                {PSY_AXIS_LABEL[axis]}
              </text>
            );
          })}
        </g>
      )}
    </svg>
  );
}
