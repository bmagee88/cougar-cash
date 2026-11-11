import React, { useRef, useState } from "react";
import { Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import CombatCharacter, { CombatEffects } from "./CombatCharacter";
import { CombatAnimation, CombatPose, POSE_MS } from "./combatAnimation";
import { TypingBossClassId } from "./types";

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
  const duration=POSE_MS[selection.state];
  const reaction=["healed","shielded","buffed","evasionReady","dodge","hit","block","reviving"].includes(selection.state);
  const event={id:`preview:${selection.serial}`,state:selection.state,at:selection.at,duration,channel:reaction?"reaction" as const:"action" as const};
  const pose:CombatAnimation={...event,...(reaction?{reaction:event}:{action:event})};
  const play=(state:CombatPose)=>setSelection(previous=>({state,at:Date.now(),serial:previous.serial+1}));
  return <Container maxWidth="lg" sx={{py:3}}>
    <Button component={Link} to="/typing-boss">Back to Typing Boss</Button>
    <Typography variant="h4" fontWeight={900}>Character animation preview</Typography>
    <Typography sx={{color:"text.secondary",my:1}}>Choose an action to compare all six classes. This local preview does not affect a live room.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{mb:3}}>
      {poses.map(([state,label])=><Button key={state} variant={selection.state===state?"contained":"outlined"} size="small" onClick={()=>play(state)}>{label}</Button>)}
      <Button onClick={()=>play(selection.state)}>Replay</Button>
    </Stack>
    <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr 1fr",md:"repeat(3,1fr)"},gap:2}}>
      {classes.map(classId=><Paper key={classId} variant="outlined" sx={{p:2,minHeight:195,overflow:"visible",bgcolor:"#182336",textAlign:"center"}}>
        <Typography sx={{fontWeight:900,textTransform:"capitalize"}}>{classId}</Typography>
        <Box sx={{display:"flex",justifyContent:"center",height:135,alignItems:"end",pb:2}}>
          <CombatCharacter classId={classId} size={105} color="#facc15" pose={pose} clock={clock} />
        </Box>
        <Chip size="small" label={poses.find(([state])=>state===selection.state)?.[1]} />
      </Paper>)}
    </Box>
    <Paper variant="outlined" sx={{p:2,mt:2,bgcolor:"#182336",textAlign:"center"}}>
      <Typography fontWeight={900}>Ancient Red Dragon</Typography>
      <Box key={event.id} className={`dragon-pose dragon-pose-${pose.state}`} data-animation={pose.state} sx={{display:"inline-block",width:240,mt:2}}
        style={{"--pose-ms":`${duration || 900}ms`} as React.CSSProperties}>
        <Box component="img" alt="Ancient Red Dragon preview" src={`${process.env.PUBLIC_URL || ""}/assets/typing-boss/ancient-red-dragon-sprite.png`} sx={{width:"100%",imageRendering:"pixelated"}} />
        <CombatEffects pose={pose} clock={clock}/>
      </Box>
    </Paper>
  </Container>;
}
