"use client";

import { RADAR_DIMENSIONS, toRadarPolygonPoints } from "@/lib/interview-radar";
import type { NormalizedRadarScores } from "@/lib/interview-radar";

interface MiniRadarChartProps {
  scores: NormalizedRadarScores;
  size?: number;
}

export function MiniRadarChart({ scores, size = 80 }: MiniRadarChartProps) {
  const padding = 14;
  const center = size / 2;
  const radius = center - padding;
  const n = RADAR_DIMENSIONS.length;

  // Axis endpoints
  const axes = RADAR_DIMENSIONS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  });

  // Background rings (25%, 50%, 75%, 100%)
  const rings = [0.25, 0.5, 0.75, 1].map((ratio) =>
    RADAR_DIMENSIONS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = radius * ratio;
      return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`;
    }).join(" "),
  );

  const scoreValues = RADAR_DIMENSIONS.map((d) => scores[d.key]);
  const dataPoints = toRadarPolygonPoints(scoreValues, size, padding);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {/* Background rings */}
      {rings.map((ring, i) => (
        <polygon
          key={i}
          points={ring}
          fill="none"
          stroke="hsl(160 10% 88%)"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {axes.map((ax, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={ax.x}
          y2={ax.y}
          stroke="hsl(160 10% 88%)"
          strokeWidth={0.5}
        />
      ))}

      {/* Data polygon */}
      {dataPoints && (
        <>
          <polygon
            points={dataPoints}
            fill="hsl(161 94% 30% / 0.18)"
            stroke="hsl(161 94% 30%)"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          {/* Data dots */}
          {RADAR_DIMENSIONS.map((d, i) => {
            const ratio = scores[d.key] / 100;
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const x = center + Math.cos(angle) * radius * ratio;
            const y = center + Math.sin(angle) * radius * ratio;
            return (
              <circle
                key={d.key}
                cx={x.toFixed(1)}
                cy={y.toFixed(1)}
                r={1.5}
                fill="hsl(161 94% 30%)"
              />
            );
          })}
        </>
      )}
    </svg>
  );
}
