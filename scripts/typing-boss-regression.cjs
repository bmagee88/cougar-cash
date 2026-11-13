const {spawnSync}=require('node:child_process');
function runChecks(files) {
  // Bulk seeded-word submissions are deliberately no longer a valid live test.
  // Keep deterministic class/queue coverage and exercise the protected wire
  // protocol through the current 31-client verifier instead.
  for(const args of [ ['--test',...files], [process.env.TYPING_BOSS_TEST_URL ? 'scripts/verify-typing-boss.cjs' : 'scripts/verify-typing-boss-performance.cjs'] ]) {
    const result=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true,
      env:{...process.env,TYPING_BOSS_BALANCED:'1',TYPING_BOSS_SCHEDULED:'1'}});
    if(result.error)console.error(result.error);
    if(result.status!==0){process.exitCode=result.status || 1;return;}
  }
}
module.exports={runChecks};
