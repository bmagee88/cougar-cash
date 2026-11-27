import React, { useRef, useState } from "react";
import { Box, Button, Checkbox, Chip, Container, FormControlLabel, Paper, Slider, Stack, Switch, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import CombatCharacter from "./CombatCharacter";
import DragonCombatSprite from "./DragonCombatSprite";
import { CombatAnimation, CombatPose, POSE_MS } from "./combatAnimation";
import { DragonHurtTier, TypingBossClassId, TypingBossId } from "./types";
import { DRAGON_HURT, DRAGON_FLAME } from "./dragonHurtRules";
import WyrmAnimationPreview from './WyrmAnimationPreview';
import KrakenPreview from './KrakenPreview';
import {bossPortraitWidth} from './bossPortraitLayout';

const dragons: [TypingBossId, string][] = [["infernalDragon", "Ancient Red Dragon"], ["cindermaw", "Cindermaw"], ["emberWhelp", "Ember Whelp"]];
const classes:TypingBossClassId[]=["paladin","cleric","barbarian","rogue","necromancer","monk"];
const poses:[CombatPose,string][]=[
  ["idle","Idle"],["weakAttack","Weapon / cast"],["strongAttack","Power attack"],["healCast","Healing ally"],["selfHeal","Self healing"],
  ["healed","Getting healed"],["shieldCast","Casting shield"],["shielded","Receiving shield"],["block","Blocking"],
  ["buffCast","Casting buff"],["buffed","Receiving buff"],["evasionReady","Evasion buff"],["dodge","Dodging"],["hit","Taking damage"],
  ["reviveCast","Reviving ally"],["reviving","Being revived"],["death","Dying"],["defeated","Knocked out"],["victory","Victory jump"],
  ["bite","Dragon bite"],["tailWhip","Dragon tail whip"],["flamethrower","Dragon flame"]
];
export default function AnimationPreview() {
  const [section,setSection]=useState(new URLSearchParams(window.location.search).get('section') || 'wyrm');
  const [kneeling,setKneeling]=useState(false),[zombieRow,setZombieRow]=useState(0);
  const clock=useRef(0);
  const [selection,setSelection]=useState({state:"idle" as CombatPose,at:Date.now(),serial:0});
  const [inspect,setInspect]=useState(false),[frame,setFrame]=useState(0);
  const duration=POSE_MS[selection.state];
  const reaction=["healed","shielded","buffed","evasionReady","dodge","hit","block","reviving"].includes(selection.state);
  const event={id:`preview:${selection.serial}`,state:selection.state,at:selection.at,duration,channel:reaction?"reaction" as const:"action" as const};
  const pose:CombatAnimation={...event,...(reaction?{reaction:event}:{action:event})};
  const play=(state:CombatPose)=>setSelection(previous=>({state,at:Date.now(),serial:previous.serial+1}));
  const [slowDragon, setSlowDragon] = useState(false);
  const [inspectDragon,setInspectDragon]=useState(false),[dragonFrame,setDragonFrame]=useState(0);
  const [dragonSelection, setDragonSelection] = useState<{ state: CombatPose; at: number; serial: number; hurtTier?: DragonHurtTier }>({ state: "bite", at: Date.now(), serial: 0 });
  const dragonDuration = (dragonSelection.hurtTier ? DRAGON_HURT[dragonSelection.hurtTier].duration : POSE_MS[dragonSelection.state]) * (slowDragon ? 8 : 1);
  const dragonFrames = dragonSelection.hurtTier ? DRAGON_HURT[dragonSelection.hurtTier].frames : dragonSelection.state === "flamethrower" ? DRAGON_FLAME.frames : 6;
  const dragonEvent = { id: `dragon-preview:${dragonSelection.serial}`, state: dragonSelection.state, at: dragonSelection.at, duration: dragonDuration, channel: dragonSelection.hurtTier ? "reaction" as const : "action" as const, hurtTier: dragonSelection.hurtTier };
  const dragonPose: CombatAnimation = { ...dragonEvent, ...(dragonSelection.hurtTier ? { reaction: dragonEvent } : { action: dragonEvent }) };
  const playDragon = (state: CombatPose, hurtTier?: DragonHurtTier) => setDragonSelection(previous => ({ state, hurtTier, at: Date.now(), serial: previous.serial + 1 }));
  return <Container maxWidth="lg" sx={{py:3}}>
    <Button component={Link} to="/typing-boss">Back to Typing Boss</Button>
    <Typography variant="h4" fontWeight={900}>Animation preview</Typography>
    <Typography sx={{color:"text.secondary",my:1}}>Replay animations or inspect their drawn frames. This preview does not affect a live room.</Typography>
    <Stack component="nav" aria-label="Animation groups" direction="row" gap={1} flexWrap="wrap" sx={{my:2}}>
      {([['wyrm','Sand Wyrm'],['dragons','Dragons'],['kraken','Kraken'],['heroes','Heroes'],['zombies','Zombie summons']] as const).map(([id,label])=><Button key={id} variant={section===id?'contained':'outlined'} aria-pressed={section===id} onClick={()=>setSection(id)}>{label}</Button>)}
    </Stack>
    {section==='wyrm' && <WyrmAnimationPreview/>}
    {section==='kraken' && <KrakenPreview/>}
    {section==='zombies' && <>
      <Typography variant="h5">Zombie summons</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{my:2}}>{['Idle','Summon','Attack','Hurt','Collapse','KO','Resurrection','Victory'].map((label,row)=><Button key={label} variant={row===zombieRow?'contained':'outlined'} onClick={()=>setZombieRow(row)}>{label}</Button>)}</Stack>
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'repeat(2,1fr)',md:'repeat(6,1fr)'},gap:1}}>{Array.from({length:6},(_,i)=><Paper key={i} sx={{p:1,bgcolor:'#273849',textAlign:'center'}}><Box sx={{width:'100%',aspectRatio:'1',backgroundImage:`url("${process.env.PUBLIC_URL || ''}/assets/typing-boss/summons/zombie-combat.webp")`,backgroundSize:'600% 800%',backgroundPosition:`${i/5*100}% ${zombieRow/7*100}%`,imageRendering:'pixelated'}}/><Typography>Frame {i+1}</Typography></Paper>)}</Box>
    </>}
    {section==='heroes' && <>
    <FormControlLabel label="Kneeling heroes" control={<Switch checked={kneeling} onChange={(_,v)=>setKneeling(v)}/>}/>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{mb:3}}>
      {poses.map(([state,label])=><Button key={state} variant={selection.state===state?"contained":"outlined"} size="small" onClick={()=>play(state)}>{label}</Button>)}
      <Button onClick={()=>{setInspect(false);play(selection.state);}}>Replay</Button>
    </Stack>
    <Stack direction="row" gap={3} alignItems="center" sx={{mb:3}}>
      <FormControlLabel control={<Checkbox checked={inspect} onChange={event=>setInspect(event.target.checked)}/>} label="Inspect player frames"/>
      <Slider aria-label="Animation frame" min={1} max={6} step={1} marks disabled={!inspect} value={frame+1}
        valueLabelDisplay="on" onChange={(_,value)=>setFrame(Number(value)-1)} sx={{maxWidth:280}}/>
    </Stack>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(2,1fr)",md:"repeat(3,1fr)"},gap:2}}>
      {classes.map(classId=><Paper key={classId} variant="outlined" sx={{p:2,minHeight:195,overflow:"visible",bgcolor:"#182336",textAlign:"center"}}>
        <Typography sx={{fontWeight:900,textTransform:"capitalize"}}>{classId}</Typography>
        <Box sx={{display:"flex",justifyContent:"center",height:220,alignItems:"end",pb:2}}>
          <CombatCharacter classId={classId} size={105} color="#facc15" pose={pose} clock={clock} inspectFrame={inspect?frame:undefined} kneeling={kneeling}/>
        </Box>
        <Chip size="small" label={poses.find(([state])=>state===selection.state)?.[1]} />
      </Paper>)}
    </Box>
    </>}
    {section==='dragons' && <>
    <Typography variant="h5" sx={{mt:3,mb:1,fontWeight:900}}>Dragon sprite sheets</Typography>
    <Typography sx={{color:"text.secondary",mb:1}}>Flame breath uses 20 drawn frames. Other attacks use six. Hurt uses 3 basic, 6 power, or 10 critical frames. Choose a sequence to replay all three dragons.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{mb:2}}>
      {([["idle", "Idle dragon"], ["bite", "Bite"], ["weakAttack", "Fireball"], ["tailWhip", "Tail whip"], ["flamethrower", "Flamethrower"], ["death","Forward collapse"], ["defeated","Collapsed dragon"]] as [CombatPose, string][]).map(([state, label]) =>
        <Button key={state} variant={!dragonSelection.hurtTier && dragonSelection.state === state ? "contained" : "outlined"} onClick={() => playDragon(state)}>{label}</Button>)}
      {(["basic", "power", "critical"] as DragonHurtTier[]).map(tier => <Button key={tier} variant={dragonSelection.hurtTier === tier ? "contained" : "outlined"}
        onClick={() => playDragon("hit", tier)}>{tier} hurt · {DRAGON_HURT[tier].frames} frames</Button>)}
      <FormControlLabel label="Slow preview" control={<Switch checked={slowDragon} onChange={(_event, checked) => { setInspectDragon(false); setSlowDragon(checked); playDragon(dragonSelection.state, dragonSelection.hurtTier); }} />} />
      <Button onClick={()=>{setInspectDragon(false);playDragon(dragonSelection.state, dragonSelection.hurtTier);}}>Replay dragons</Button>
    </Stack>
    <Stack direction="row" gap={3} alignItems="center" sx={{mb:3}}>
      <FormControlLabel control={<Checkbox checked={inspectDragon} onChange={event=>setInspectDragon(event.target.checked)}/>} label="Inspect dragon frames"/>
      <Slider aria-label="Dragon animation frame" min={1} max={dragonFrames} step={1} marks disabled={!inspectDragon} value={Math.min(dragonFrame+1,dragonFrames)}
        valueLabelDisplay="on" onChange={(_,value)=>setDragonFrame(Number(value)-1)} sx={{maxWidth:280}}/>
    </Stack>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(3,1fr)"},gap:2}}>
      {dragons.map(([bossId,label])=><Paper key={bossId} variant="outlined" sx={{p:2,bgcolor:"#182336",textAlign:"center"}}>
        <Typography fontWeight={900}>{label}</Typography>
        <Box sx={{display:"flex",justifyContent:"center",mt:2}}>
          <DragonCombatSprite bossId={bossId} width={{xs:210,md:256}} glow="#ef4444" pose={dragonPose} clock={clock} inspectFrame={inspectDragon?dragonFrame:undefined}/>
        </Box>
        <Typography variant="caption">Typing profile bounds</Typography>
        <Box className="typing-portrait typing-dragon-portrait" sx={{mx:'auto',mt:1}}>
          <div className="portrait-dragon"><DragonCombatSprite bossId={bossId} width={bossPortraitWidth(bossId)} glow="#ef4444" pose={dragonPose} clock={clock} inspectFrame={inspectDragon?dragonFrame:undefined}/></div>
        </Box>
      </Paper>)}
    </Box>
    </>}
  </Container>;
}
