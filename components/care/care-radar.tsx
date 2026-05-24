"use client";

import { useLocale } from "next-intl";
import { CARE_AXES, type CareRadar } from "@/lib/care-quality/types";
import { CARE_SHORT_FR, CARE_SHORT_EN } from "@/lib/care-quality/axes";
import { cn } from "@/lib/utils";

export type CareLayer = {
  key: string;
  radar: CareRadar;
  color: string;
  fillOpacity: number;
  strokeWidth: number;
};

const VIEW_W = 440;
const VIEW_H = 360;
const CX = 220;
const CY = 180;
const R = 130;
const N = CARE_AXES.length;

function angleFor(i: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / N;
}
function pointFor(i: number, frac: number): [number, number] {
  const a = angleFor(i);
  return [CX + Math.cos(a) * R * frac, CY + Math.sin(a) * R * frac];
}
function gridPolygon(scale: number): string {
  return CARE_AXES.map((_, i) =>
    pointFor(i, scale)
      .map((n) => n.toFixed(2))
      .join(",")
  ).join(" ");
}
function labelAnchor(x: number): "start" | "middle" | "end" {
  if (x < CX - 5) return "end";
  if (x > CX + 5) return "start";
  return "middle";
}

export function CareRadar({
  layers,
  size = 320,
  className,
}: {
  layers: CareLayer[];
  size?: number;
  className?: string;
}) {
  const locale = useLocale();
  const shortMap = locale === "en" ? CARE_SHORT_EN : CARE_SHORT_FR;
  const gridScales = [0.25, 0.5, 0.75, 1];

  const axisHasValue = CARE_AXES.map((axis) =>
    layers.some((l) => l.radar[axis] !== null)
  );
  const last = layers[layers.length - 1];

  return (
    <svg
      role="img"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={size}
      height={size * (VIEW_H / VIEW_W)}
      className={cn("block", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon
        points={gridPolygon(1)}
        fill="#FBE0E8"
        fillOpacity={0.6}
        stroke="none"
        aria-hidden="true"
      />
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
        {CARE_AXES.map((axis, i) => {
          const [x, y] = pointFor(i, 1);
          const observed = axisHasValue[i];
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

      <g>
        {layers.map((layer) => {
          const pts = CARE_AXES.map((axis, i) => ({ axis, i }))
            .filter(({ axis }) => layer.radar[axis] !== null)
            .map(({ axis, i }) => {
              const v = (layer.radar[axis] as number) / 100;
              return pointFor(i, v)
                .map((n) => n.toFixed(2))
                .join(",");
            });
          if (pts.length < 3) return null;
          return (
            <polygon
              key={layer.key}
              points={pts.join(" ")}
              fill={layer.color}
              fillOpacity={layer.fillOpacity}
              stroke={layer.color}
              strokeWidth={layer.strokeWidth}
              strokeLinejoin="round"
            />
          );
        })}
      </g>

      <polygon
        points={gridPolygon(1)}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
        strokeLinejoin="round"
        aria-hidden="true"
      />

      {last && (
        <g>
          {CARE_AXES.map((axis, i) => {
            const raw = last.radar[axis];
            if (raw === null) return null;
            const v = raw / 100;
            const [x, y] = pointFor(i, v);
            const [lx, ly] = pointFor(i, Math.min(v + 0.12, 1.05));
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
                  {raw}
                </text>
              </g>
            );
          })}
        </g>
      )}

      <g>
        {CARE_AXES.map((axis, i) => {
          const [x, y] = pointFor(i, 1.18);
          const observed = axisHasValue[i];
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
              {shortMap[axis]}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
