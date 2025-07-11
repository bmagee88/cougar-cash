import React, { forwardRef } from "react";
import { createNoise2D } from "simplex-noise";
import LAPIS from "../assets/images/textures/lapis/lapis1.jpg";

type Layer = {
  amplitude: number;
  frequency: number;
};

type Props = {
  size: number;
  layers: Layer[];
  scaleX?: number; // added
  scaleY?: number; // added
  rotation?: number; // in degrees
  textureScale?: number; // 0.5 = zoom in, 2.0 = zoom out
  textureOffsetX?: number;
  textureOffsetY?: number;
  textureUrl?: string;
};

const PerlinCompositeAmorphicShape = forwardRef<SVGSVGElement, Props>(
  (
    {
      size,
      layers,
      scaleX = 1,
      scaleY = 1,
      rotation,
      textureScale = 1,
      textureOffsetX = 0,
      textureOffsetY = 0,
      textureUrl,
    },
    ref
  ) => {
    // const rockTextureUrl = "https://www.transparenttextures.com/patterns/rocky-wall.png";
    console.log(textureUrl);
    const rockTextureUrl = textureUrl || LAPIS;
    console.log(rockTextureUrl);
    const center = size;
    const baseRadius = size;
    const steps = 100;
    const angleStep = (Math.PI * 2) / steps;

    const noise2D = createNoise2D();
    const points: [number, number][] = [];

    for (let i = 0; i < steps; i++) {
      const angle = i * angleStep;
      const xUnit = Math.cos(angle);
      const yUnit = Math.sin(angle);

      let offset = 0;
      for (const { amplitude, frequency } of layers) {
        offset += noise2D(xUnit * frequency, yUnit * frequency) * amplitude;
      }

      const r = baseRadius + offset;
      const x = center + r * Math.cos(angle) * scaleX;
      const y = center + r * Math.sin(angle) * scaleY;
      points.push([x, y]);
    }

    const pathData =
      points.map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`)).join(" ") + " Z";

    return (
      <svg
        ref={ref}
        width={size * 2}
        height={size * 2}
        xmlns='http://www.w3.org/2000/svg'>
        <defs>
          {/* Rock pattern */}
          <pattern
            id='rockPattern'
            patternUnits='userSpaceOnUse'
            width='500'
            height='500'>
            <image
              href={rockTextureUrl}
              width='500'
              height='500'
              x={-textureOffsetX}
              y={-textureOffsetY}
              preserveAspectRatio='xMidYMid slice'
            />
          </pattern>

          {/* Depth + light filter */}
          <filter
            id='depthLighting'
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
              lightingColor='#ffffff'
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
              result='litShape'
            />
            <feMerge>
              <feMergeNode in='litShape' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
        </defs>

        <g transform={`rotate(${rotation}, ${size}, ${size})`}>
          <path
            d={pathData}
            fill='url(#rockPattern)'
            filter='url(#depthLighting)'
          />
        </g>
      </svg>
    );
  }
);

PerlinCompositeAmorphicShape.displayName = "PerlinCompositeAmorphicShape";

export default PerlinCompositeAmorphicShape;
