import React from "react";

type Layer = {
  amplitude: number; // like jaggedness
  frequency: number; // like lumpiness
};

type Props = {
  size: number;
  layers: Layer[]; // up to 3 levels of distortion
};

const CompositeAmorphousShape: React.FC<Props> = ({ size, layers }) => {
  const center = size;
  const baseRadius = size / 2;
  const steps = 100;

  const angleStep = (Math.PI * 2) / steps;
  const points: [number, number][] = [];

  for (let i = 0; i < steps; i++) {
    const angle = i * angleStep;

    // Add up all the layers’ distortions (interference)
    let offset = 0;
    for (const { amplitude, frequency } of layers) {
      offset += Math.sin(angle * frequency) * amplitude;
    }

    const r = baseRadius + offset;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    points.push([x, y]);
  }

  const pathData =
    points.map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`)).join(" ") + " Z";

  return (
    <svg
      width={size * 2}
      height={size * 2}>
      <path
        d={pathData}
        fill='#88ccff'
        stroke='#333'
        strokeWidth={2}
      />
    </svg>
  );
};

export default CompositeAmorphousShape;
