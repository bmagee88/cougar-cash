import React from "react";
import { Box } from "@mui/material";

/**
 * Full-viewport SVG overlay that draws animated caustics.
 * All styling is done through MUI’s `sx` prop.
 */
const WaterOverlay: React.FC = () => (
  <Box
    component='svg'
    viewBox='0 0 100 100'
    preserveAspectRatio='none'
    sx={{
      position: "fixed",
      inset: 0,
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: (theme) => theme.zIndex.modal + 1,
      mixBlendMode: "overlay", // try `soft-light` or `screen` too
      opacity: 0.5, // dial to taste
    }}>
    <defs>
      {/* Animated fractal-noise “height map” */}
      <filter
        id='water-caustics'
        x='-20%'
        y='-20%'
        width='140%'
        height='140%'>
        <feTurbulence
          type='turbulence'
          baseFrequency='0.015 0.03'
          numOctaves={3}
          seed={2}
          result='TURB'>
          <animate
            attributeName='baseFrequency'
            dur='10s'
            keyTimes='0;0.5;1'
            values='0.015 0.03;0.02 0.035;0.015 0.03'
            repeatCount='indefinite'
          />
        </feTurbulence>

        {/* Soften the noise into smooth highlights */}
        <feGaussianBlur stdDeviation='8' />

        {/* Boost contrast so bright bits pop */}
        <feColorMatrix
          type='matrix'
          values='
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 12 -5'
        />
      </filter>
    </defs>

    {/* Translucent rectangle that *shows* the caustics */}
    <rect
      width='100%'
      height='100%'
      filter='url(#water-caustics)'
      fill='#b3e5ff' // pale water-blue
      fillOpacity='0.2' // lower if you only want highlights
    />
  </Box>
);

export default WaterOverlay;
