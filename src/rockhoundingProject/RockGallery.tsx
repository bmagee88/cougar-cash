// RockGallery.tsx
import React, { useMemo } from "react";
import PerlinCompositeAmorphicShape from "./PerlinCompositeAmorphicShape";

/* ---------- helper utilities ------------------------------------- */
const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

const getRandomisedShape = () => ({
  layers: [
    { amplitude: randomInRange(5, 25), frequency: 0.4 },
    { amplitude: randomInRange(5, 25), frequency: 0.4 },
    { amplitude: 4, frequency: randomInRange(0.4, 2) },
  ],
  scaleX: randomInRange(0.3, 0.8),
  scaleY: randomInRange(0.3, 0.8),
  rotation: Math.floor(randomInRange(0, 180)),
  textureScale: randomInRange(0.5, 1),
  textureOffsetX: randomInRange(80, 210),
  textureOffsetY: randomInRange(80, 210),
});

/* ---------- texture catalogue ------------------------------------ */
const textureFolders: Record<string, number> = {
  lapis: 2,
  redjasper: 3,
  unakite: 4,
  sapphire: 2,
  mossagate: 2,
  // (… keep the full list here …)
  epidote: 1,
};
const folderNames = Object.keys(textureFolders);

const pickRandomFolder = () => folderNames[Math.floor(Math.random() * folderNames.length)];

const pickRandomTexture = (folder: string) => {
  const max = textureFolders[folder];
  const idx = Math.floor(Math.random() * max) + 1;
  return `/assets/images/textures/${folder}/${folder}${idx}.jpg`;
};

/* ---------- main gallery component ------------------------------- */
const RockGallery: React.FC = () => {
  /** create 10 rock configs exactly once (useMemo to avoid re-randomising) */
  const rocks = useMemo(() => {
    return Array.from({ length: 10 }, () => {
      const folder = pickRandomFolder();
      return {
        folder,
        textureUrl: pickRandomTexture(folder),
        ...getRandomisedShape(),
      };
    });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "1rem",
      }}>
      {rocks.map((rock, i) => (
        <div
          key={i}
          //   style={{ flex: "0 1 120px" }}
        >
          {/* Adjust size to taste (here 100) */}
          <PerlinCompositeAmorphicShape
            size={100}
            layers={rock.layers}
            scaleX={rock.scaleX}
            scaleY={rock.scaleY}
            rotation={rock.rotation}
            textureScale={rock.textureScale}
            textureOffsetX={rock.textureOffsetX}
            textureOffsetY={rock.textureOffsetY}
            textureUrl={rock.textureUrl}
          />
        </div>
      ))}
    </div>
  );
};

export default RockGallery;
