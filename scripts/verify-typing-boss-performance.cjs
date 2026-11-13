// Keep the isolated server and its clients in one process tree/network context.
const { spawn } = require('node:child_process');
const {randomBytes}=require('node:crypto');
// A throwaway password is shared only by this isolated server and its verifier.
const testEnvironment={...process.env,TYPING_BOSS_CREATION_PASSWORD:randomBytes(24).toString('hex')};
const port = '4005';
const verifierScript=process.argv.includes('--countdown') ? 'scripts/verify-battle-countdown.cjs' : 'scripts/verify-typing-boss.cjs';
const server = spawn(process.execPath,['server/appServer.js'], {
  env:{...testEnvironment,APP_SERVER_PORT:port}, windowsHide:true, stdio:['ignore','pipe','inherit'],
});
let verifier;
const deadline=setTimeout(()=>{console.error('Local verifier timed out.');verifier?.kill();server.kill();process.exitCode=1;},60000);
server.stdout.on('data',chunk=>{
  if(verifier || !chunk.toString().includes('backend listening'))return;
  verifier=spawn(process.execPath,[verifierScript],{
    env:{...testEnvironment,TYPING_BOSS_TEST_URL:`http://127.0.0.1:${port}/api/typing-boss/sessions`},
    windowsHide:true,stdio:'inherit',
  });
  verifier.on('exit',code=>{clearTimeout(deadline);server.kill();process.exitCode=code ?? 1;});
  verifier.on('error',error=>{console.error(error);clearTimeout(deadline);server.kill();process.exitCode=1;});
});
server.on('error',error=>{console.error(error);clearTimeout(deadline);process.exitCode=1;});
server.on('exit',code=>{if(!verifier){clearTimeout(deadline);process.exitCode=code || 1;}});
