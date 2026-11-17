import {getTypingBossEventSourceUrl,getTypingBossSession,submitTypingBossWords,verifyTypingBossParticipant,createTypingBossChallenge,unlockTypingBossCreation,createTypingBossParticipant} from './api';
declare const test:any,expect:any,jest:any,afterEach:any;
const originalFetch=global.fetch;
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
