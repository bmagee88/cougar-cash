import React, { useRef, useState } from "react";
import CompositeAmorphousShape from "./CompositeAmorphousShape";
import PerlinCompositeAmorphicShape from "./PerlinCompositeAmorphicShape";

const CompositeDemo = () => {
  const [layers, setLayers] = useState([
    { amplitude: 15, frequency: 0.4 }, // Layer 1
    { amplitude: 15, frequency: 0.4 }, // Layer 2
    { amplitude: 4, frequency: 1.0 }, // Layer 3
  ]);

  const [scaleX, setScaleX] = useState(0.5);
  const [scaleY, setScaleY] = useState(0.5);
  const [rotation, setRotation] = useState(0); // degrees: 0–180

  const [textureScale, setTextureScale] = useState(0.5);
  const [textureOffsetX, setTextureOffsetX] = useState(0);
  const [textureOffsetY, setTextureOffsetY] = useState(0);

  const [folder, setFolder] = useState("lapis");
  const [textureUrl, setTextureUrl] = useState("/assets/images/textures/lapis/lapis1.jpg");

  const textureFolders: Record<string, number> = {
    lapis: 2, // number of images in that folder
    redjasper: 3,
    unakite: 4,
    sapphire: 2,
    mossagate: 2,
    yellowjasperbanded: 1,
    serpentine: 2,
    jade: 1,
    adventurine: 1,
    rosequartz: 1,
    amethyst: 1,
    carnelian: 2,
    sodalite: 1,
    bluekyanite: 1,
    blackkyanite: 1,
    opal: 1,
    blackopal: 1,
    malachite: 1,
    prehnite: 1,
    schistgarnet: 1,
    basalt: 1,
    granite: 2,
    rhyolite: 1,
    andesite: 1,
    diorite: 1,
    pumice: 1,
    obsidian: 1,
    pegmatite: 1,
    starsapphiregranite: 1,
    feldspar: 1,
    tuff: 1,
    olivinebasalt: 1,
    goldore: 1,
    slate: 1,
    platinumore: 1,
    silverore: 1,
    copperore: 1,
    lead: 1,
    chalcedony: 3,
    chrysoprase: 2,
    gneiss: 1,
    quartzite: 1,
    marble: 1,
    soapstone: 1,
    epidote: 1,
  };

  const pickRandomTexture = (folderName: string) => {
    const count = textureFolders[folderName];
    const randomIndex = Math.floor(Math.random() * count) + 1;
    const location = `/assets/images/textures/${folderName}/${folderName}${randomIndex}.jpg`;
    console.log(location);
    return location;
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setFolder(selected);
    const textureUrl = pickRandomTexture(selected);
    setTextureUrl(textureUrl);
  };

  const svgRef = useRef<SVGSVGElement>(null);

  const updateLayer = (index: number, key: "amplitude" | "frequency", value: number) => {
    setLayers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "amorphous-shape.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const randomizeValues = () => {
    const newLayers = [
      {
        amplitude: randomInRange(5, 25),
        frequency: 0.4,
      },
      {
        amplitude: randomInRange(5, 25),
        frequency: 0.4,
      },
      {
        amplitude: 4,
        frequency: randomInRange(0.4, 2),
      },
    ];

    setLayers(newLayers);
    setScaleX(randomInRange(0.3, 0.8));
    setScaleY(randomInRange(0.3, 0.8));
    setRotation(Math.floor(randomInRange(0, 180)));
    setTextureScale(randomInRange(0.5, 1));
    setTextureOffsetX(randomInRange(80, 210)); // allow shifting around inside 500x500
    setTextureOffsetY(randomInRange(80, 210));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", alignItems: "center" }}>
      <button
        onClick={randomizeValues}
        style={{ marginTop: "1rem", marginRight: "1rem" }}>
        🎲 Randomize Shape
      </button>
      <button onClick={downloadSVG}>Download SVG</button>
      <label>
        Stone Type:
        <select
          value={folder}
          onChange={handleFolderChange}>
          {Object.keys(textureFolders).map((name) => (
            <option
              key={name}
              value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <PerlinCompositeAmorphicShape
          size={100}
          layers={layers}
          ref={svgRef}
          scaleX={scaleX}
          scaleY={scaleY}
          rotation={rotation}
          textureScale={textureScale}
          textureOffsetX={textureOffsetX}
          textureOffsetY={textureOffsetY}
          textureUrl={textureUrl}
        />
      </div>
      <div style={{ marginTop: "1rem" }}>
        <label>
          Width Scale (X):
          <input
            type='range'
            min={0.3}
            max={0.8}
            step={0.01}
            value={scaleX}
            onChange={(e) => setScaleX(Number(e.target.value))}
          />
          {scaleX.toFixed(2)}
        </label>
        <br />
        <label>
          Height Scale (Y):
          <input
            type='range'
            min={0.3}
            max={0.8}
            step={0.01}
            value={scaleY}
            onChange={(e) => setScaleY(Number(e.target.value))}
          />
          {scaleY.toFixed(2)}
        </label>
        <br />
        <label>
          Rotation:
          <input
            type='range'
            min={0}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
          {rotation}°
        </label>
      </div>

      <div>
        {layers.map((layer, i) => (
          <div
            key={i}
            style={{ marginBottom: "1rem" }}>
            <h4>Layer {i + 1}</h4>

            {/* Layer 1 & 2: amplitude adjustable, freq fixed */}
            {i < 2 && (
              <>
                <label>
                  Amplitude:
                  <input
                    type='range'
                    min={5}
                    max={25}
                    step={0.5}
                    value={layer.amplitude}
                    onChange={(e) => updateLayer(i, "amplitude", Number(e.target.value))}
                  />
                  {layer.amplitude.toFixed(1)}
                </label>
                <br />
                <label>
                  Frequency: <strong>0.4 (fixed)</strong>
                </label>
              </>
            )}

            {/* Layer 3: amplitude fixed, freq adjustable */}
            {i === 2 && (
              <>
                <label>
                  Amplitude: <strong>4.0 (fixed)</strong>
                </label>
                <br />
                <label>
                  Frequency:
                  <input
                    type='range'
                    min={0.4}
                    max={2}
                    step={0.1}
                    value={layer.frequency}
                    onChange={(e) => updateLayer(i, "frequency", Number(e.target.value))}
                  />
                  {layer.frequency.toFixed(1)}
                </label>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompositeDemo;
