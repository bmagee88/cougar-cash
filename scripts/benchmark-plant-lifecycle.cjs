// Standalone Node microbenchmark. Uses the installed TypeScript compiler;
// loading/transpiling is excluded from the measured generation intervals.
const fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const memory=new Map();global.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
const file=path.resolve(__dirname,'../src/FishingTypingGame/engine/plantLifecycle.ts');
const {WORLD,worldAt}=require('../src/FishingTypingGame/engine/world.ts');
const world={seed:'plant-performance-reference-v1',generationVersion:1};
const at=worldAt(WORLD.epoch+119*WORLD.dayMs+1),locations=['dock','cove','birch'];
const samples=[];
for(let trial=0;trial<5;trial++){
 memory.clear();delete require.cache[file];const lifecycle=require(file),cold={};
 for(const location of locations){const start=performance.now();lifecycle.plantSnapshot(location,at,world);cold[location]=performance.now()-start;}
 const coldStats=lifecycle.plantGenerationStats();
 const hotStart=performance.now();for(let n=0;n<1000;n++)lifecycle.plantSnapshot('dock',at,world);
 const hot1000Ms=performance.now()-hotStart;
 delete require.cache[file];const reload=require(file),reloadStart=performance.now();for(const location of locations)reload.plantSnapshot(location,at,world);
 samples.push({coldMs:cold,hot1000Ms,reloadThreeLocationsMs:performance.now()-reloadStart,coldStats,reloadStats:reload.plantGenerationStats(),checkpointBytes:Buffer.byteLength(memory.get(lifecycle.PLANT_CHECKPOINT_KEY)||'')});
}
const report={node:process.version,dayMs:WORLD.dayMs,case:'119-day cold reconstruction; 1000 cache hits; reload from checkpoints',samples};
const output=process.argv[2]||path.resolve(__dirname,'../output/plant-lifecycle-art/benchmark.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
