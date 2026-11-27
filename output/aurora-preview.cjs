const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, file) => {
  if (!file.startsWith(path.join(root, 'src') + path.sep)) throw new Error(file);
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  } }).outputText, file);
};
const FishingScene = require('../src/FishingTypingGame/scene/FishingScene.tsx').default;
const { worldAt, WORLD } = require('../src/FishingTypingGame/engine/world.ts');
const world = worldAt(WORLD.epoch, { hour: 22, moonPhase: 'new', season: 'summer' });
function preview(location, phone = false) {
  const scene = renderToStaticMarkup(React.createElement(FishingScene, {
    game: { phase: 'idle' }, location, world, weather: 'sunny', reducedMotion: true,
    cameraDrift: false, skyPreview: { aurora: true, meteors: false },
  }));
  return `<h2>${location}${phone ? ' · portrait' : ''}</h2><div class="f-game"><div class="preview ${phone ? 'phone' : ''}">${scene}</div></div>`;
}
const label = process.argv[2] || 'after';
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aurora ${label}</title><style>${fs.readFileSync(path.join(root, 'src/FishingTypingGame/fishing.css'), 'utf8')}</style><style>
  body{margin:0;background:#08101b;color:#c9d9de;font:14px system-ui;padding:24px}h2{font-size:15px;font-weight:500;margin:12px 0}.f-game{padding:0!important;min-height:0!important;background:none!important}.preview{position:relative;height:650px;max-width:1300px;overflow:hidden;border-radius:12px}.preview.phone{width:390px;height:760px}.preview .f-scene{position:absolute;inset:0}
</style>${preview('dock')}${preview('cove')}${preview('birch')}${preview('dock', true)}`;
fs.writeFileSync(path.join(__dirname, `aurora-${label}.html`), html);
console.log(`Wrote aurora-${label}.html`);
