const fs = require("fs");
const path = require("path");

const packageRoot = path.join(__dirname, "..", "node_modules", "chess.js");
const sourcePath = path.join(packageRoot, "src", "chess.ts");
const badSource = "../../../src/chess.ts";
const goodSource = "../../src/chess.ts";
const mapPaths = [
  path.join(packageRoot, "dist", "cjs", "chess.js.map"),
  path.join(packageRoot, "dist", "esm", "chess.js.map"),
];

if (!fs.existsSync(packageRoot)) {
  process.exit(0);
}

if (!fs.existsSync(sourcePath)) {
  console.warn("Skipping chess.js source map patch: src/chess.ts was not found.");
  process.exit(0);
}

const sourceContent = fs.readFileSync(sourcePath, "utf8");
let patchedCount = 0;

for (const mapPath of mapPaths) {
  if (!fs.existsSync(mapPath)) continue;

  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  if (!Array.isArray(map.sources)) continue;

  let changed = false;
  let sourceIndex = map.sources.indexOf(badSource);

  if (sourceIndex >= 0) {
    map.sources[sourceIndex] = goodSource;
    changed = true;
  } else {
    sourceIndex = map.sources.indexOf(goodSource);
  }

  if (sourceIndex < 0) continue;

  if (!Array.isArray(map.sourcesContent)) {
    map.sourcesContent = [];
    changed = true;
  }

  while (map.sourcesContent.length < map.sources.length) {
    map.sourcesContent.push(null);
    changed = true;
  }

  if (map.sourcesContent[sourceIndex] !== sourceContent) {
    map.sourcesContent[sourceIndex] = sourceContent;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(mapPath, JSON.stringify(map));
    patchedCount += 1;
  }
}

if (patchedCount > 0) {
  console.log(`Patched chess.js source maps in ${patchedCount} file(s).`);
}
