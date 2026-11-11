import React, { useRef, useState } from "react";
import { Box, Button, Checkbox, Chip, Container, FormControlLabel, Paper, Slider, Stack, Switch, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import CombatCharacter from "./CombatCharacter";
import DragonCombatSprite from "./DragonCombatSprite";
import { CombatAnimation, CombatPose, POSE_MS } from "./combatAnimation";
import { TypingBossClassId, TypingBossId } from "./types";

const dragons: [TypingBossId, string][] = [["infernalDragon", "Ancient Red Dragon"], ["cindermaw", "Cindermaw"], ["emberWhelp", "Ember Whelp"]];
const classes:TypingBossClassId[]=["paladin","cleric","barbarian","rogue","necromancer","monk"];
const poses:[CombatPose,string][]=[
  ["idle","Idle"],["weakAttack","Weapon / cast"],["strongAttack","Power attack"],["healCast","Healing ally"],["selfHeal","Self healing"],
  ["healed","Getting healed"],["shieldCast","Casting shield"],["shielded","Receiving shield"],["block","Blocking"],
  ["buffCast","Casting buff"],["buffed","Receiving buff"],["evasionReady","Evasion buff"],["dodge","Dodging"],["hit","Taking damage"],
  ["reviveCast","Reviving ally"],["reviving","Being revived"],["death","Dying"],["defeated","Knocked out"],
  ["bite","Dragon bite"],["tailWhip","Dragon tail whip"],["flamethrower","Dragon flame"]
];
export default function AnimationPreview() {
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
  const [dragonSelection, setDragonSelection] = useState({ state: "bite" as CombatPose, at: Date.now(), serial: 0 });
  const dragonDuration = POSE_MS[dragonSelection.state] * (slowDragon ? 8 : 1);
  const dragonEvent = { id: `dragon-preview:${dragonSelection.serial}`, state: dragonSelection.state, at: dragonSelection.at, duration: dragonDuration, channel: "action" as const };
  const dragonPose: CombatAnimation = { ...dragonEvent, action: dragonEvent };
  const playDragon = (state: CombatPose) => setDragonSelection(previous => ({ state, at: Date.now(), serial: previous.serial + 1 }));
  return <Container maxWidth="lg" sx={{py:3}}>
    <Button component={Link} to="/typing-boss">Back to Typing Boss</Button>
    <Typography variant="h4" fontWeight={900}>Character animation preview</Typography>
    <Typography sx={{color:"text.secondary",my:1}}>Choose an action to compare all six classes. This local preview does not affect a live room.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{mb:3}}>
      {poses.map(([state,label])=><Button key={state} variant={selection.state===state?"contained":"outlined"} size="small" onClick={()=>play(state)}>{label}</Button>)}
      <Button onClick={()=>{setInspect(false);play(selection.state);}}>Replay</Button>
    </Stack>
    <Stack direction="row" gap={3} alignItems="center" sx={{mb:3}}>
      <FormControlLabel control={<Checkbox checked={inspect} onChange={event=>setInspect(event.target.checked)}/>} label="Inspect player frames"/>
      <Slider aria-label="Animation frame" min={1} max={6} step={1} marks disabled={!inspect} value={frame+1}
        valueLabelDisplay="on" onChange={(_,value)=>setFrame(Number(value)-1)} sx={{maxWidth:280}}/>
    </Stack>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr 1fr",md:"repeat(3,1fr)"},gap:2}}>
      {classes.map(classId=><Paper key={classId} variant="outlined" sx={{p:2,minHeight:195,overflow:"visible",bgcolor:"#182336",textAlign:"center"}}>
        <Typography sx={{fontWeight:900,textTransform:"capitalize"}}>{classId}</Typography>
        <Box sx={{display:"flex",justifyContent:"center",height:135,alignItems:"end",pb:2}}>
          <CombatCharacter classId={classId} size={105} color="#facc15" pose={pose} clock={clock} inspectFrame={inspect?frame:undefined}/>
        </Box>
        <Chip size="small" label={poses.find(([state])=>state===selection.state)?.[1]} />
      </Paper>)}
    </Box>
    <Typography variant="h5" sx={{mt:3,mb:1,fontWeight:900}}>Dragon sprite sheets</Typography>
    <Typography sx={{color:"text.secondary",mb:1}}>Each attack uses six drawn poses. Choose an attack to replay all three dragons.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{mb:2}}>
      {([["idle", "Idle dragon"], ["bite", "Bite"], ["weakAttack", "Fireball"], ["tailWhip", "Tail whip"], ["flamethrower", "Flamethrower"]] as [CombatPose, string][]).map(([state, label]) =>
        <Button key={state} variant={dragonSelection.state === state ? "contained" : "outlined"} onClick={() => playDragon(state)}>{label}</Button>)}
      <FormControlLabel label="Slow preview" control={<Switch checked={slowDragon} onChange={(_event, checked) => { setInspectDragon(false); setSlowDragon(checked); playDragon(dragonSelection.state); }} />} />
      <Button onClick={()=>{setInspectDragon(false);playDragon(dragonSelection.state);}}>Replay dragons</Button>
    </Stack>
    <Stack direction="row" gap={3} alignItems="center" sx={{mb:3}}>
      <FormControlLabel control={<Checkbox checked={inspectDragon} onChange={event=>setInspectDragon(event.target.checked)}/>} label="Inspect dragon frames"/>
      <Slider aria-label="Dragon animation frame" min={1} max={6} step={1} marks disabled={!inspectDragon} value={dragonFrame+1}
        valueLabelDisplay="on" onChange={(_,value)=>setDragonFrame(Number(value)-1)} sx={{maxWidth:280}}/>
    </Stack>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"repeat(3,1fr)"},gap:2}}>
      {dragons.map(([bossId,label])=><Paper key={bossId} variant="outlined" sx={{p:2,bgcolor:"#182336",textAlign:"center"}}>
        <Typography fontWeight={900}>{label}</Typography>
        <Box sx={{display:"flex",justifyContent:"center",mt:2}}>
          <DragonCombatSprite bossId={bossId} width={256} glow="#ef4444" pose={dragonPose} clock={clock} inspectFrame={inspectDragon?dragonFrame:undefined}/>
        </Box>
      </Paper>)}
    </Box>
  </Container>;
}
