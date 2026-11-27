import React,{useRef,useState} from 'react';
import {Box,Button,Chip,FormControlLabel,Paper,Slider,Stack,Switch,Typography} from '@mui/material';
import WyrmSprite from './WyrmVisuals';
import {CombatAnimation} from './combatAnimation';
import {TypingBossBoss,TypingBossSessionSnapshot,WyrmAction} from './types';
import {BattleScene} from './TypingBossApp';
import {WYRM_ACTIONS} from './wyrmRules';
import {bossPortraitWidth} from './bossPortraitLayout';
const sequences=[
  {id:'idle',label:'Idle',row:0},{id:'wyrmBite',label:'Bite',row:1},{id:'slam',label:'Slam',row:2},
  {id:'overrun',label:'Overrun · full 8s sequence',row:3},{id:'burrow',label:'Burrow',row:4},
  {id:'underground',label:'Underground',row:4},{id:'emerge',label:'Ground eruption',row:5},
  {id:'consume',label:'Consume',row:6},{id:'spitOut',label:'Spit out',row:7},
  {id:'basic',label:'Basic hurt',row:8},{id:'power',label:'Power hurt',row:9},{id:'critical',label:'Critical hurt',row:10},
  {id:'death',label:'Collapse',row:11},{id:'defeated',label:'KO',row:11},
];
export default function WyrmAnimationPreview(){
  const clock=useRef(0),[selection,setSelection]=useState({id:'idle',at:Date.now(),serial:0});
  const [inspect,setInspect]=useState(false),[frame,setFrame]=useState(0),[bounds,setBounds]=useState(true),[arena,setArena]=useState(false);
  const seq=sequences.find(s=>s.id===selection.id)!,at=selection.at;
  const play=(id:string)=>{setInspect(false);setSelection(s=>({id,at:Date.now(),serial:s.serial+1}));};
  const boss={id:'giantSandWyrm',name:'Giant Sand Wyrm',hp:600,maxHp:600,color:'#d6a44c',glow:'#d6a44c'} as TypingBossBoss;
  let pose:CombatAnimation={id:`preview:${selection.serial}`,state:'idle',at,duration:1500};
  if(seq.id in WYRM_ACTIONS){const kind=seq.id as WyrmAction['kind'];boss.wyrmAction={id:pose.id,kind,at,until:at+WYRM_ACTIONS[kind].duration,targetCode:'hero0'};}
  if(seq.id==='burrow'||seq.id==='underground')boss.wyrmBurrowed=true;
  if(seq.id==='emerge')boss.wyrmAction={id:pose.id,kind:'overrun',at:at-5500,until:at+2500};
  if(['basic','power','critical'].includes(seq.id)){const tier=seq.id as 'basic'|'power'|'critical';pose={...pose,state:'hit',hurtTier:tier,duration:tier==='basic'?300:tier==='power'?660:1200};boss.hurt={id:pose.id,tier,at,until:at+pose.duration};}
  if(seq.id==='death'||seq.id==='defeated')pose={...pose,state:seq.id,duration:1800};
  const session={id:'animation-studio',mode:'proportional',status:'active',teamMode:true,boss,players:Array.from({length:6},(_,i)=>({code:`hero${i}`,name:`Hero ${i+1}`,classId:'paladin',color:'#facc15',hp:100,maxHp:100,defeated:false})),projectiles:[],log:[]} as unknown as TypingBossSessionSnapshot;
  const inspection=inspect?{row:seq.row,frame:seq.id==='underground'||seq.id==='defeated'?5:frame}:undefined;
  return <section aria-label="Giant Sand Wyrm animation preview">
    <Typography variant="h5" fontWeight={900}>Giant Sand Wyrm</Typography>
    <Typography sx={{my:1}}>Replay the live movement, inspect any of the six drawn frames, or compare the whole sequence below. Overrun intentionally leaves the screen before returning.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{my:2}}>{sequences.map(s=><Button key={s.id} variant={s.id===seq.id?'contained':'outlined'} size="small" onClick={()=>play(s.id)}>{s.label}</Button>)}</Stack>
    <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
      <Button onClick={()=>play(seq.id)}>Replay Wyrm</Button>
      <FormControlLabel label="Inspect Wyrm frames" control={<Switch checked={inspect} onChange={(_,v)=>setInspect(v)}/>}/>
      <Slider aria-label="Wyrm animation frame" min={1} max={6} step={1} marks disabled={!inspect} value={frame+1} onChange={(_,v)=>setFrame(Number(v)-1)} valueLabelDisplay="auto" sx={{width:240}}/>
      <FormControlLabel label="Show frame bounds" control={<Switch checked={bounds} onChange={(_,v)=>setBounds(v)}/>}/>
    </Stack>
    <Box sx={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center',alignItems:'end',mt:2}}>
      <Paper variant="outlined" sx={{p:2,bgcolor:'#273849',overflow:'hidden',maxWidth:'100%'}}>
        <Typography>Battlefield size</Typography>
        <Box data-testid="wyrm-preview-stage" sx={{width:{xs:240,md:360},height:{xs:240,md:360},position:'relative',outline:bounds?'1px dashed #9dc6dd':undefined}}>
          <WyrmSprite boss={boss} pose={pose} width={{xs:240,md:360}} clock={clock} inspection={inspection}/>
        </Box>
      </Paper>
      <Paper variant="outlined" sx={{p:2,bgcolor:'#273849'}}>
        <Typography>Typing-profile size</Typography>
        <Box className="typing-portrait typing-dragon-portrait" sx={{outline:bounds?'1px dashed #9dc6dd':undefined}}>
          <div className="portrait-dragon"><WyrmSprite boss={boss} pose={pose} width={bossPortraitWidth('giantSandWyrm')} clock={clock} inspection={inspection}/></div>
        </Box>
      </Paper>
    </Box>
    <Typography sx={{mt:3,mb:1,fontWeight:800}}>All six frames · {seq.label}</Typography>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'repeat(2,minmax(0,1fr))',sm:'repeat(3,minmax(0,1fr))',md:'repeat(6,minmax(0,1fr))'},gap:1}}>
      {Array.from({length:6},(_,i)=><Paper key={i} variant="outlined" sx={{p:1,bgcolor:'#273849',minWidth:0,textAlign:'center'}}>
        <Box sx={{width:'100%',aspectRatio:'1',position:'relative',outline:bounds?'1px dashed #698da3':undefined}}>
          <div data-testid="wyrm-contact-frame" style={{position:'absolute',inset:0,backgroundImage:`url("${process.env.PUBLIC_URL || ''}/assets/typing-boss/wyrm/combat-v2.webp")`,backgroundSize:'600% 1200%',backgroundPosition:`${i/5*100}% ${seq.row/11*100}%`,imageRendering:'pixelated'}}/>
        </Box><Chip size="small" label={`Frame ${i+1}`}/>
      </Paper>)}
    </Box>
    <FormControlLabel label="Show full battlefield" control={<Switch checked={arena} onChange={(_,v)=>setArena(v)}/>}/>
    {arena && <Box sx={{height:420,my:2}}><BattleScene session={session}/></Box>}
  </section>;
}
