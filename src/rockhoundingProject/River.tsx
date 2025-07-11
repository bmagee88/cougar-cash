// River.tsx
import React, { useState, useRef } from "react";
import PerlinCompositeAmorphicShape from "./PerlinCompositeAmorphicShape";
import RockGallery from "./RockGallery";
import WaterOverlay from "./WaterOverlay";
import { WaterFilterDefs } from "./WaterFilterDefs";
import Box from "@mui/material/Box";

/* ---------- River component ----------------------------------------- */
const River: React.FC = () => (
  <>
    <WaterFilterDefs /> {/* hidden <defs> */}
    <img
      src='/assets/images/textures/sand/sand1.jpg'
      alt='Sandy riverbed'
      style={{
        position: "absolute",
        top: "-50px",
        left: "-50px",
        width: "calc(100vw + 1000px)",
        height: "calc(100vh + 1000px)",
        // objectFit: "cover", // stretches while keeping aspect
        filter: "url(#water-displacement)",
        display: "block",
        zIndex: -1, // optional if you want to layer other content above
      }}
    />
    <Box
      sx={{
        position: "absolute",
        inset: 0, // stretch to fill
        pointerEvents: "none",
        filter: "url(#water-displacement)", // same distortion
      }}>
      <RockGallery />
    </Box>
    {/* </Box> */}
  </>
);

export default River;

//  <>
//     <WaterFilterDefs /> {/* hidden <defs> */}
//     <Box
//       sx={{
//         width: "100vw",
//         height: "100vh",
//         filter: "url(#water-displacement)", // <- distortion here
//       }}>
//       <RockGallery />
//     </Box>
//   </>
