import React from "react";

type Props = {
  size: number; // Overall size of the shape
  jaggedness: number; // How sharp the deviations are
  lumpiness: number; // Number of lobes / sine waves
};

const AmorphousShape: React.FC<Props> = ({ size, jaggedness, lumpiness }) => {
  const points: [number, number][] = [];
  const center = size;
  const radius = size;

  const angleStep = (Math.PI * 2) / 100;

  for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
    const noise = Math.sin(angle * lumpiness) * jaggedness;
    const r = radius + noise;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    points.push([x, y]);
  }

  const pathData =
    points.map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`)).join(" ") + " Z"; // Close the path

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

export default AmorphousShape;
