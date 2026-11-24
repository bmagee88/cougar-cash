import React,{useEffect,useState} from 'react';
import {CombatAnimation} from './combatAnimation';
import {TypingBossClassId,ZombieSummon} from './types';
import './summonSprites.css';

const assets=`${(process.env.PUBLIC_URL || '').replace(/\/$/,'')}/assets/typing-boss`;
const classes:TypingBossClassId[]=['paladin','cleric','barbarian','rogue','necromancer','monk'];
export function KneelingCharacter({classId,size,pose,clock,inspectFrame}:{classId:TypingBossClassId;size:number;pose?:CombatAnimation;clock:React.MutableRefObject<number>;inspectFrame?:number}) {
  const action=pose?.action || pose;
  const attack=action && !['idle','hit','block','dodge','healed','shielded','buffed'].includes(action.state);
  const elapsed=attack?Math.max(0,Date.now()+clock.current-action.at):0;
  const width=Math.round(size*1.35);
  return <span data-testid="combat-character" data-character={classId} data-animation="kneeling" data-action={attack?'kneelingAttack':undefined}
    className={`combat-actor kneeling-actor${pose?.state==='hit'?' kneeling-hit':''}`} aria-hidden="true" style={{width:size*.85,height:size}}>
    <span key={attack?action.id:'rest'} className={`kneeling-frames ${attack?'kneeling-attack':'kneeling-rest'}`} style={{
      width,height:width,bottom:-width*12/128,left:'50%',marginLeft:-width/2,
      backgroundImage:`url("${assets}/kneeling/party-kneeling.webp")`,backgroundPositionY:`${classes.indexOf(classId)/5*100}%`,
      animationDuration:attack?`${action.duration}ms`:'1500ms',animationDelay:`-${elapsed}ms`,
      ...(inspectFrame!==undefined?{animation:'none',backgroundPositionX:`${inspectFrame/5*100}%`}:{}),
    }}/>
  </span>;
}
const rows={idle:0,spawn:1,attack:2,hit:3,death:4,ko:5,resurrection:6,victory:7};
export function zombiePose(summon:ZombieSummon,now:number,defeatPose?:CombatAnimation,victoryAt?:number) {
  if(defeatPose)return {state:now<defeatPose.at+defeatPose.duration?'death':'ko',at:defeatPose.at,duration:defeatPose.duration || 900};
  if(!summon.alive)return {state:now<summon.changedAt+900?'death':'ko',at:summon.changedAt,duration:900};
  if(victoryAt!==undefined)return {state:'victory',at:victoryAt,duration:900};
  const duration=summon.event==='resurrection'?1100:900;
  if(now<summon.changedAt+duration)return {state:summon.event,at:summon.changedAt,duration};
  if(summon.attackAt!==undefined && now<summon.attackAt+620)return {state:'attack',at:summon.attackAt,duration:620};
  return {state:'idle',at:0,duration:1500};
}
function ZombieSprite({summon,clock,defeatPose,victoryAt}:{summon:ZombieSummon;clock:React.MutableRefObject<number>;defeatPose?:CombatAnimation;victoryAt?:number}) {
  const [,redraw]=useState(0),now=Date.now()+clock.current;
  const pose=zombiePose(summon,now,defeatPose,victoryAt),loop=pose.state==='idle' || pose.state==='victory';
  useEffect(()=>{
    if(loop || pose.state==='ko')return;
    const timer=setTimeout(()=>redraw(value=>value+1),Math.max(1,pose.at+pose.duration-Date.now()-clock.current)+8);
    return ()=>clearTimeout(timer);
  },[pose.at,pose.duration,pose.state,loop,clock]);
  return <span className={`zombie-summon zombie-${pose.state}`} data-testid="zombie-summon" data-slot={summon.slot} data-state={pose.state}
    role="img" aria-label={`Zombie ${summon.slot+1}${pose.state==='ko' || pose.state==='death'?' KO':''}`}>
    <i key={`${pose.state}:${pose.at}`} style={{backgroundImage:`url("${assets}/summons/zombie-combat.webp")`,backgroundPositionY:`${rows[pose.state as keyof typeof rows]/7*100}%`,
      animationDuration:`${pose.duration}ms`,animationDelay:loop?undefined:`-${Math.max(0,now-pose.at)}ms`,animationIterationCount:loop?'infinite':1}}/>
  </span>;
}
export default function SummonParty({summons,clock,portrait=false,defeatPose,victoryAt}:{summons?:ZombieSummon[];clock:React.MutableRefObject<number>;portrait?:boolean;defeatPose?:CombatAnimation;victoryAt?:number}) {
  if(!summons?.length)return null;
  return <span className={`summon-party${portrait?' summon-party-portrait':''}`} aria-label="Zombie summons">
    {summons.map(summon=><ZombieSprite key={summon.slot} summon={summon} clock={clock} defeatPose={defeatPose} victoryAt={victoryAt}/>)}
  </span>;
}
