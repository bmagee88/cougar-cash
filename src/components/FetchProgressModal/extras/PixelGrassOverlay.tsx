// extras/PixelGrassOverlay.tsx
import React from "react";

/**
 * Renders N tiled pixel-grass layers that sit over the background and
 * below UI/creatures. Each layer has a unique X offset for variety.
 *
 * rows: how many layers to draw. Cap for perf (default cap: 12).
 */
export function PixelGrassOverlay({ rows = 1, cap = 12 }: { rows?: number; cap?: number }) {
  const count = Math.max(1, Math.min(rows, cap));
  return (
    <div className="pixel-grass-overlay" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const x = (i * 53) % 128;             // unique X offset per layer
        const opacity = 0.55 + (i / count) * 0.35; // 0.55..0.90 front-to-back
        return (
          <div
            key={i}
            className="pixel-grass-layer"
            style={
              {
                ["--x" as any]: `${x}px`,
                ["--o" as any]: opacity.toString(),
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
