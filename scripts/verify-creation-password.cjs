const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {once}=require('node:events');
const password=randomBytes(24).toString('hex');
const port='4006';
async function verify(configured) {
  const child=spawn(process.execPath,['server/appServer.js'],{windowsHide:true,
    env:{...process.env,APP_SERVER_PORT:port,TYPING_BOSS_CREATION_PASSWORD:configured?password:''},stdio:['ignore','pipe','pipe']});
  const exited=once(child,'exit');
  let game;
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Test server startup timed out.')),10000);
      child.on('error',error=>{clearTimeout(timer);reject(error);});
      child.stdout.on('data',chunk=>{if(chunk.toString().includes('backend listening')){clearTimeout(timer);resolve();}});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('Test server exited before becoming ready.'));});
    });
    const post=async(path,body,status)=>{
      const response=await fetch(`http://127.0.0.1:${port}/api/typing-boss/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();assert.equal(response.status,status,`${path}: ${result.error || 'unexpected status'}`);return result;
    };
    if(!configured) {
      await post('creation-access',{},503);await post('creation-access',{password},503);
      await post('sessions',{mode:'proportional'},503);await post('sessions',{mode:'proportional',creationPassword:password},503);
    } else {
      await post('creation-access',{},403);await post('creation-access',{password:randomBytes(24).toString('hex')},403);
      await post('sessions',{mode:'proportional'},403);await post('sessions',{mode:'proportional',creationPassword:randomBytes(24).toString('hex')},403);
      await post('creation-access',{password},200);
      game=await post('sessions',{mode:'proportional',creationPassword:password},201);
      await post(`sessions/${game.sessionId}/close`,{hostToken:game.hostToken},200);
    }
    console.log(JSON.stringify({configured,creationAccess:'passed',sessionCreation:'passed'}));
  } finally {child.kill();await exited;}
}
(async()=>{await verify(false);await verify(true);})().catch(error=>{console.error(error);process.exitCode=1;});
