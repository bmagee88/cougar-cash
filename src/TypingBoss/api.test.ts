import {getTypingBossEventSourceUrl,getTypingBossSession,submitTypingBossWords,verifyTypingBossParticipant,createTypingBossChallenge,unlockTypingBossCreation,createTypingBossParticipant,startTypingBossSession,promoteTypingBossPlayer,setTypingBossPlayerPromotion} from './api';
declare const test:any,expect:any,jest:any,afterEach:any;
const originalFetch=global.fetch;

test('Double Promoted requests send tier 2 with the normal-damage flag, and reject an outdated backend',async()=>{
  const fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({promotionToken:'signed',session:{typing:{promotionLevel:2,promoted:false},players:[{code:'hero',promotionLevel:2,promoted:false}]}})}));
  global.fetch=fetch as any;
  await promoteTypingBossPlayer('bossABC','player-secret','host-password',2);
  expect(JSON.parse(fetch.mock.calls[0][1].body).promotionLevel).toBe(2);
  await setTypingBossPlayerPromotion('bossABC','host-secret','hero',2);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({hostToken:'host-secret',playerCode:'hero',promotionLevel:2,promoted:false});
  global.fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({session:{typing:{promoted:true},players:[{code:'hero',promoted:false}]}})})) as any;
  await expect(promoteTypingBossPlayer('bossABC','player-secret','host-password',2)).rejects.toThrow('matching Typing Boss backend');
  await expect(setTypingBossPlayerPromotion('bossABC','host-secret','hero',2)).rejects.toThrow('matching Typing Boss backend');
});

test.each(['lan','wan'])('Start carries the selected %s music policy and rejects an outdated backend for WAN',async(networkMode:'lan'|'wan')=>{
  const fetch=jest.fn(async(_url:string,options:any)=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({session:{mode:'proportional',teamMode:true,networkMode:JSON.parse(options.body).networkMode}})}));
  global.fetch=fetch as any;
  await startTypingBossSession('bossABC','host',1,undefined,undefined,false,true,true,300,networkMode);
  expect(JSON.parse(fetch.mock.calls[0][1].body).networkMode).toBe(networkMode);
  global.fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({session:{mode:'proportional',teamMode:true}})})) as any;
  if(networkMode==='wan')await expect(startTypingBossSession('bossABC','host',1,undefined,undefined,false,true,true,300,'wan')).rejects.toThrow('backend did not apply WAN music');
  else await expect(startTypingBossSession('bossABC','host')).resolves.toBeTruthy();
});
afterEach(()=>{global.fetch=originalFetch;jest.useRealTimers();});

test('future joins send the remembered signed promotion without a stored password',async()=>{
  const key='typingBossDevicePromotion:v1',grant=`v1.${'a'.repeat(32)}.${'b'.repeat(64)}`;
  localStorage.setItem(key,grant);
  const fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({playerToken:'a'.repeat(64)})}));global.fetch=fetch as any;
  try {await createTypingBossParticipant('bossABC','Hero','paladin');const body=JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.promotionToken).toBe(grant);expect(body.password).toBeUndefined();
  }finally{localStorage.removeItem(key);}
});

test.each(['connection','response body'])('unlock times out a stalled %s, aborts it, and allows a retry',async(stage:string)=>{
  jest.useFakeTimers();
  const fetch=jest.fn(()=>stage==='connection'?new Promise(()=>{}):Promise.resolve({ok:true,headers:{get:()=> 'application/json'},text:()=>new Promise(()=>{})}));
  global.fetch=fetch as any;
  const pending=unlockTypingBossCreation('test-only');
  const assertion=expect(pending).rejects.toThrow('did not respond within 30 seconds');
  await Promise.resolve();
  jest.advanceTimersByTime(30000);
  await assertion;
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  global.fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>'{"allowed":true}'})) as any;
  await expect(unlockTypingBossCreation('test-only')).resolves.toEqual({allowed:true});
  expect(jest.getTimerCount()).toBe(0);
});
test('private player tokens authenticate snapshots, events, words, verification and old-mode challenges',async()=>{
  const fetch=jest.fn(async()=>({ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({nextWord:1})}));
  global.fetch=fetch as any;
  const credentials={code:'heroAAAA',playerToken:'a'.repeat(64)};
  const events=new URL(getTypingBossEventSourceUrl('bossABC',credentials),'http://localhost');
  expect(events.searchParams.get('playerToken')).toBe(credentials.playerToken);
  await getTypingBossSession('bossABC',credentials);
  expect(fetch.mock.calls[0][0]).toContain('playerToken=');
  await submitTypingBossWords('bossABC',credentials,[]);
  expect(JSON.parse(fetch.mock.calls[1][1].body).playerToken).toBe(credentials.playerToken);
  await verifyTypingBossParticipant('bossABC',credentials.playerToken);
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({playerToken:credentials.playerToken});
  await createTypingBossChallenge('bossABC',credentials.playerToken,'weak');
  expect(JSON.parse(fetch.mock.calls[3][1].body).playerToken).toBe(credentials.playerToken);
});
