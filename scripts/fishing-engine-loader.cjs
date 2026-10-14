const fs = require('fs');
const ts = require('typescript');
const path = require('path');
const engine = path.resolve(__dirname, '../src/FishingTypingGame/engine');
// Restrict the transient TypeScript loader to this game's pure engine.
require.extensions['.ts'] = (module, file) => {
  if (!file.startsWith(engine + path.sep)) throw new Error(`Unexpected TypeScript module: ${file}`);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  module._compile(output.outputText, file);
};
module.exports = { ...require('../src/FishingTypingGame/engine/encounters.ts'), ...require('../src/FishingTypingGame/engine/config.ts') };
