import { DragonHurtTier, TypingBossProjectile } from "./types";
import { DRAGON_FLAME } from "./dragonHurtRules";

export type CombatPose = "idle" | "weakAttack" | "strongAttack" | "healCast" | "selfHeal" | "healed" |
  "shieldCast" | "shielded" | "buffCast" | "buffed" | "evasionReady" | "reviveCast" | "reviving" | "dodge" | "hit" | "block" |
  "death" | "defeated" | "bite" | "tailWhip" | "flamethrower";
export const POSE_MS: Record<CombatPose, number> = {
  idle:900, weakAttack:620, strongAttack:780, healCast:780, selfHeal:800, healed:700,
  shieldCast:780, shielded:700, buffCast:780, buffed:700, evasionReady:700, reviveCast:900, reviving:1100,
  dodge:520, hit:460, block:520, death:950, defeated:0, bite:820, tailWhip:820, flamethrower:DRAGON_FLAME.duration,
};
export const POSE_ROW: Record<CombatPose, number> = {
  idle:0, weakAttack:1, strongAttack:1, healCast:2, selfHeal:2, healed:3,
  shieldCast:2, shielded:5, buffCast:2, buffed:0, evasionReady:0, reviveCast:2, reviving:6,
  dodge:4, hit:5, block:5, death:7, defeated:7, bite:1, tailWhip:1, flamethrower:1,
};
export type CombatAnimationEvent = { id:string; state:CombatPose; at:number; duration:number; channel:"action"|"reaction"; critical?:boolean; hurtTier?:DragonHurtTier };
export type CombatAnimation = { state:CombatPose; id:string; at:number; duration:number; action?:CombatAnimationEvent; reaction?:CombatAnimationEvent; block?:CombatAnimationEvent; nextAt?:number; hurtTier?:DragonHurtTier };
export const NO_ANIMATION_EVENTS: readonly CombatAnimationEvent[] = [];

export function collectCombatAnimations(projectiles: readonly TypingBossProjectile[]) {
  const actors = new Map<string,CombatAnimationEvent[]>();
  const add = (actor:string, projectile:TypingBossProjectile, state:CombatPose, at:number, channel:"action"|"reaction") => {
    const event = {id:`${projectile.id}:${channel}`,state,at,duration:POSE_MS[state],channel,critical:projectile.critical,
      ...(actor === "boss" && state === "hit" ? { hurtTier: projectile.critical ? "critical" as const : projectile.moveId === "strong" ? "power" as const : "basic" as const } : {})};
    const list = actors.get(actor) || []; list.push(event); actors.set(actor,list);
  };
  for (const shot of projectiles) {
    const selfHeal = shot.kind === "heal" && shot.source === shot.target;
    const cast:CombatPose = shot.kind === "heal" ? selfHeal ? "selfHeal" : "healCast" :
      shot.kind === "resurrect" ? "reviveCast" : shot.kind === "buff" ? shot.moveId === "goldShield" ? "shieldCast" : "buffCast" :
      shot.bossAttack === "bite" ? "bite" : shot.bossAttack === "tailWhip" ? "tailWhip" : shot.bossAttack === "flamethrower" ? "flamethrower" :
      shot.moveId === "strong" ? "strongAttack" : "weakAttack";
    add(shot.source,shot,cast,shot.animationStartedAt ?? shot.startedAt,"action");
    if (!shot.resolvedAt || shot.result === "pending") continue;
    if (shot.result === "evade" || shot.result === "miss") {
      if (shot.kind === "damage" || shot.kind === "boss") add(shot.target,shot,"dodge",shot.resolvedAt,"reaction");
      continue;
    }
    else if (shot.kind === "heal" && (shot.amount || 0)>0) add(shot.target,shot,"healed",shot.resolvedAt,"reaction");
    else if (shot.kind === "resurrect" && (shot.amount || 0)>0) add(shot.target,shot,"reviving",shot.resolvedAt,"reaction");
    else if (shot.kind === "buff") add(shot.target,shot,shot.moveId === "goldShield" ? "shielded" : shot.moveId === "rogueSpecial" ? "evasionReady" : "buffed",shot.resolvedAt,"reaction");
    else if ((shot.amount || 0)>0) add(shot.target,shot,"hit",shot.resolvedAt,"reaction");
    if (shot.blockedAmount && shot.result === "hit") add(shot.target,{...shot,id:`${shot.id}:guard`},"block",shot.resolvedAt,"reaction");
  }
  return actors;
}

const priority = (event:CombatAnimationEvent) => event.state === "reviving" ? 100 : event.state === "selfHeal" ? 85 :
  event.state === "hit" ? 80+(event.critical?1:0) : event.state === "dodge" || event.state === "block" ? 75 :
  event.channel === "reaction" ? 60 : 40;
function latest(events:readonly CombatAnimationEvent[]) {
  return events.reduce<CombatAnimationEvent | undefined>((best,event) => !best ||
    (Math.abs(event.at-best.at)<=80 ? priority(event)>priority(best) || (priority(event)===priority(best) && event.at>=best.at) : event.at>best.at) ? event : best,undefined);
}

export function selectCombatAnimation(events:readonly CombatAnimationEvent[], now:number, defeated=false): CombatAnimation {
  const live = events.filter(event => event.at<=now && now<event.at+event.duration);
  const action=latest(live.filter(event=>event.channel==="action"));
  const reaction=latest(live.filter(event=>event.channel==="reaction"));
  const block=latest(live.filter(event=>event.state==="block"));
  if (defeated) {
    const hit=latest(events.filter(event=>event.channel==="reaction" && event.state==="hit" && event.at<=now));
    if (hit && now<hit.at+POSE_MS.death) return {state:"death",id:`${hit.id}:death`,at:hit.at,duration:POSE_MS.death,nextAt:hit.at+POSE_MS.death};
    return {state:"defeated",id:"defeated",at:now,duration:0};
  }
  // Revival is completed before normal attacks resume visually; incoming feedback still overlays it.
  const revival=live.find(event=>event.state==="reviving");
  const primary=revival || latest([...(action?[action]:[]),...(reaction?[reaction]:[])]);
  const future=events.filter(event=>event.at>now).map(event=>event.at);
  const nextAt=Math.min(...[action,reaction,block,revival].filter(Boolean).map(event=>event!.at+event!.duration),...future);
  return primary ? {...primary,action,reaction,block,nextAt:Number.isFinite(nextAt)?nextAt:undefined} :
    {state:"idle",id:"idle",at:now,duration:POSE_MS.idle,nextAt:Number.isFinite(nextAt)?nextAt:undefined};
}
