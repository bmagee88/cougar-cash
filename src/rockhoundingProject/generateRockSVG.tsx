// generateRockSVG.tsx   (note the .tsx extension)
import React from "react";
import { createNoise2D } from "simplex-noise";

const TEXTURE_URLS = [
  "/assets/textures/lapis/lapis1.jpg",
  "/assets/textures/andesite/andesite1.jpg",
  "/assets/textures/diorite/diorite1.jpg",
  "/assets/textures/obsidian/obsidian1.jpg",
];

// ------------------------------------------------------------------
// MAIN FACTORY – now typed to return a React element
// ------------------------------------------------------------------
export function generateRockSVG(opts?: {
  minSize?: number;
  maxSize?: number;
  layers?: number;
  textureUrls?: string[];
}): React.ReactElement {
  const {
    minSize = 60,
    maxSize = 200,
    layers = Math.floor(Math.random() * 3) + 4,
    textureUrls = TEXTURE_URLS,
  } = opts ?? {};

  /* randomised parameters */
  const size = randInt(minSize, maxSize);
  const scaleX = randFloat(0.8, 1.2);
  const scaleY = randFloat(0.8, 1.2);
  const rotation = randInt(0, 360);
  const textureUrl = textureUrls[randInt(0, textureUrls.length - 1)];
  const textureScale = randFloat(0.8, 1.8);
  const textureOffsetX = randInt(-150, 150);
  const textureOffsetY = randInt(-150, 150);

  const layersCfg = Array.from({ length: layers }, () => ({
    amplitude: randFloat(size * 0.05, size * 0.2),
    frequency: randFloat(0.3, 1.0),
  }));

  /* geometry */
  const center = size;
  const baseRadius = size;
  const steps = 100;
  const angleStep = (Math.PI * 2) / steps;
  const noise2D = createNoise2D();
  const pts: [number, number][] = [];

  for (let i = 0; i < steps; i++) {
    const angle = i * angleStep;
    const xUnit = Math.cos(angle);
    const yUnit = Math.sin(angle);

    let offset = 0;
    for (const { amplitude, frequency } of layersCfg) {
      offset += noise2D(xUnit * frequency, yUnit * frequency) * amplitude;
    }

    const r = baseRadius + offset;
    const x = center + r * Math.cos(angle) * scaleX;
    const y = center + r * Math.sin(angle) * scaleY;
    pts.push([x, y]);
  }

  const d = pts.map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`)).join(" ") + " Z";

  const uid = `rock${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

  /* ----------------------------------------------------------------
     Return actual JSX – React will emit the SVG element directly
     -------------------------------------------------------------- */
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size * 2}
      height={size * 2}
      viewBox={`0 0 ${size * 2} ${size * 2}`}
      style={{ display: "block" }}>
      <defs>
        <pattern
          id={`${uid}Pattern`}
          patternUnits='userSpaceOnUse'
          width={500 * textureScale}
          height={500 * textureScale}>
          <image
            href={textureUrl}
            width={500 * textureScale}
            height={500 * textureScale}
            x={-textureOffsetX}
            y={-textureOffsetY}
            preserveAspectRatio='xMidYMid slice'
          />
        </pattern>

        <filter
          id={`${uid}Depth`}
          x='-50%'
          y='-50%'
          width='200%'
          height='200%'>
          <feGaussianBlur
            in='SourceAlpha'
            stdDeviation='1.5'
            result='blur'
          />
          <feDiffuseLighting
            in='blur'
            lightingColor='#fff'
            surfaceScale='3'
            result='light'>
            <feDistantLight
              azimuth='135'
              elevation='40'
            />
          </feDiffuseLighting>
          <feComposite
            in='light'
            in2='SourceGraphic'
            operator='in'
            result='lit'
          />
          <feMerge>
            <feMergeNode in='lit' />
            <feMergeNode in='SourceGraphic' />
          </feMerge>
        </filter>
      </defs>

      <g transform={`rotate(${rotation}, ${size}, ${size})`}>
        <path
          d={d}
          fill={`url(#${uid}Pattern)`}
          filter={`url(#${uid}Depth)`}
        />
      </g>
    </svg>
  );
}

/* helpers */
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
