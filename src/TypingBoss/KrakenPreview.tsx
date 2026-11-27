import React,{useEffect,useRef,useState} from 'react';
import {Box,Button,Stack,Typography} from '@mui/material';
import {BattleScene,PlayerTypingBattle} from './TypingBossApp';
import {createTypingState,initializeBalanced} from './proportionalRules';
import {TypingBossSessionSnapshot} from './types';
import KrakenSprite from './KrakenAtlasSprite';
import {CombatAnimation} from './combatAnimation';
import {KRAKEN_ANIMATIONS,KrakenAction} from './krakenAnimationRules';

export default function KrakenPreview(){
  const [effect,setEffect]=useState({kind:'none',at:Date.now()}),[count,setCount]=useState(12);
  const [selected,setSelected]=useState<KrakenAction>('tentacleStrike'),[frame,setFrame]=useState<number>(),[resolved,setResolved]=useState(false);
  const [promoted,setPromoted]=useState(false),clock=useRef(0);
  const [bossHealth,setBossHealth]=useState(1);
  const config=KRAKEN_ANIMATIONS[selected];
  const play=(kind:KrakenAction)=>{setSelected(kind);setFrame(undefined);setResolved(false);setEffect({kind:kind==='special'?'curse':kind,at:Date.now()});};
  useEffect(()=>{const timer=setTimeout(()=>setResolved(true),config.impact);return()=>clearTimeout(timer);},[effect.at,config.impact]);
  const cast=effect.kind==='curse'?{id:String(effect.at),at:effect.at,until:effect.at+KRAKEN_ANIMATIONS.special.duration}:undefined;
  const state=initializeBalanced(createTypingState(1,'paladin'));state.balancedPower=21.5;state.balancedOrangePower=8.25;state.balancedCritBonus=.12;
  state.promoted=promoted;
  const attacking=effect.kind in KRAKEN_ANIMATIONS;
  const targets=effect.kind==='tentacleStrike'?1:effect.kind==='tentacleSweep'?Math.min(count,8):count;
  const session={id:'preview',name:'Kraken preview',mode:'proportional',status:'active',balanced:true,serverNow:Date.now(),typing:state,
    boss:{id:'kraken',name:'Abyssal Kraken',color:'#22d3ee',glow:'#22d3ee',hp:(count+(promoted?1:0))*100*bossHealth,maxHp:(count+(promoted?1:0))*100,attackCharacters:35,
      krakenCast:cast,krakenWave:effect.kind==='tidalWave'?{id:String(effect.at),at:effect.at,until:effect.at+config.duration,krakenAttack:'tidalWave'}:undefined},
    players:Array.from({length:count},(_,i)=>({code:`hero${i}`,name:`Hero ${i+1}`,classId:'paladin',color:'#facc15',hp:100,maxHp:100,promoted:i===0 && promoted,defeated:false,totalDamage:0,totalTaken:0,
      ...(i===0 && effect.kind==='prone'?{proneUntil:effect.at+5000}:{}),...(i===0 && effect.kind==='curse'?{curseUntil:effect.at+15000}:{})})),
    projectiles:attacking?Array.from({length:targets},(_,i)=>({id:`${effect.at}:${i}`,source:'boss',target:`hero${i}`,kind:'boss',bossId:'kraken',bossAttack:effect.kind,moveId:'weak',
      startedAt:effect.at,impactAt:effect.at+config.impact,result:resolved?'hit':'pending',resolvedAt:resolved?effect.at+config.impact:null,willHit:true,amount:20})):[],log:[]} as unknown as TypingBossSessionSnapshot;
  const pose={id:String(effect.at),state:selected==='tentacleStrike'?'bite':selected==='tentacleSweep'?'tailWhip':'weakAttack',at:effect.at,duration:config.duration,
    ...(selected!=='special'?{krakenAttack:selected}:{})} as CombatAnimation;
  const inspectionCast=selected==='special'?{id:String(effect.at),at:effect.at,until:effect.at+config.duration}:undefined;
  return <Box className="kraken-preview" sx={{p:2}}><Typography variant="h5">Kraken battle preview</Typography><Typography>Replay each attack, or inspect its drawn frames. No room or battle submissions.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{my:2}}>{(Object.entries(KRAKEN_ANIMATIONS) as [KrakenAction,typeof config][]).map(([kind,value])=><Button key={kind} variant={selected===kind?'contained':'outlined'} onClick={()=>play(kind)}>{value.label} · {value.frames} frames</Button>)}</Stack>
    <Box sx={{maxWidth:680,mx:'auto',border:'1px solid #164e63',borderRadius:3,overflow:'hidden',background:'radial-gradient(ellipse at 50% 80%,#164e63,#020617 75%)'}}>
      <KrakenSprite width="100%" pose={pose} clock={clock} cast={inspectionCast} inspectFrame={frame}/>
    </Box>
    <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center" alignItems="center" sx={{my:1}}>
      <Button onClick={()=>play(selected)}>Replay</Button><Button onClick={()=>setFrame(Math.floor(config.impact/config.duration*config.frames))}>Inspect impact frame</Button>
      <Button disabled={frame===undefined || frame===0} onClick={()=>setFrame(Math.max(0,(frame || 0)-1))}>Previous frame</Button>
      <Button disabled={frame===undefined || frame===config.frames-1} onClick={()=>setFrame(Math.min(config.frames-1,(frame || 0)+1))}>Next frame</Button>
      <Typography>{frame===undefined?`${config.duration/1000}s playback`:`Frame ${frame+1} / ${config.frames}`}</Typography>
    </Stack>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{my:2}}><Button onClick={()=>setEffect({kind:'prone',at:Date.now()})}>Prone for 5 seconds</Button><Button onClick={()=>setCount(count===12?30:12)}>{count===12?'Show 30 players':'Show 12 players'}</Button><Button onClick={()=>setPromoted(!promoted)}>{promoted?'Preview normal hero':'Preview promoted hero'}</Button><Button onClick={()=>setBossHealth(hp=>Math.max(0,hp-.25))}>Hit boss for 25% HP</Button><Button onClick={()=>setBossHealth(1)}>Reset boss HP</Button></Stack>
    <PlayerTypingBattle session={session} me={session.players[0]} code="hero0" active={false}/>
    <Typography sx={{mt:2}}>Classroom view</Typography><BattleScene session={session}/>
  </Box>;
}

