import React from 'react';
import {Alert,Button,IconButton,TextField,Tooltip} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import CheckIcon from '@mui/icons-material/Check';
import CombatCharacter from './CombatCharacter';
import MenuFrame from './MenuFrame';
import {TypingBossClassId} from './types';
import './characterSelect.css';

const HEROES:{id:TypingBossClassId;name:string;role:string;color:string;tagline:string;description:string}[]=[
  {id:'cleric',name:'Cleric',role:'SUPPORT',color:'#f0d194',tagline:'Help heal your team.',description:'Type a gold word. Help your team heal.'},
  {id:'barbarian',name:'Barbarian',role:'DAMAGE',color:'#ee9874',tagline:'Type two more words for more power.',description:'Type a gold word. Get two more words. Type them for more power.'},
  {id:'paladin',name:'Paladin',role:'DEFENSE',color:'#a8c7db',tagline:'Give a friend a shield.',description:'Type a gold word. Give a friend a shield. It can block a hit.'},
  {id:'rogue',name:'Rogue',role:'EVASION',color:'#c7aedc',tagline:'Get one more try to dodge a hit.',description:'Type a gold word. Get one more try to dodge a hit.'},
  {id:'necromancer',name:'Necromancer',role:'SUMMONER',color:'#b6ceab',tagline:'Raise zombies to fight at your side.',description:'In Team mode, gold raises a zombie. Type its green word to make it attack. In individual battles, gold can wake a fallen friend.'},
  {id:'monk',name:'Monk',role:'FOCUS',color:'#dfb68b',tagline:'Get more gold. Type fewer words.',description:'You get twice as many gold words. Your next hit needs fewer words.'},
];

export default function CharacterSelect({classId,onClassChange,name,onShuffle,code,onCodeChange,onJoin,busy,error,canJoin}:{
  classId:TypingBossClassId;onClassChange:(id:TypingBossClassId)=>void;name:string;onShuffle:()=>void;code:string;
  onCodeChange:(value:string)=>void;onJoin:()=>void;busy:boolean;error:string;canJoin:boolean;
}) {
  const selected=HEROES.find(hero=>hero.id===classId)!;
  return <MenuFrame className="tb-character-select" backHref="/typing-boss" backLabel="Main menu">
    <header className="tb-select-heading">
      <p className="tb-menu-eyebrow"><span/> YOUR PARTY AWAITS</p>
      <h1>Choose your <em>hero.</em></h1>
      <p className="tb-menu-intro">Six ways to make a difference. One dragon to defeat.</p>
    </header>
    <div className="tb-select-layout">
      <section className="tb-select-roster" aria-labelledby="tb-roster-title">
        <div className="tb-select-section-title"><span className="tb-menu-card-label"><span>01</span> CHOOSE YOUR CLASS</span><span id="tb-roster-title">Every hero has a place.</span></div>
        <div className="tb-select-cards">
          {HEROES.map(hero=><button type="button" key={hero.id} aria-label={hero.name} aria-pressed={classId===hero.id}
            className={`tb-hero-card${classId===hero.id?' tb-hero-selected':''}`} disabled={busy} onClick={()=>onClassChange(hero.id)}
            style={{'--hero-accent':hero.color} as React.CSSProperties}>
            <span className="tb-hero-card-role">{hero.role}</span>
            <span className="tb-hero-check" aria-hidden="true">{classId===hero.id && <CheckIcon fontSize="small"/>}</span>
            <span className="tb-hero-art"><CombatCharacter classId={hero.id} color={hero.color} size={92} inspectFrame={0}/></span>
            <strong>{hero.name}</strong><span className="tb-hero-tagline">{hero.tagline}</span>
            <span className="tb-hero-card-foot">{classId===hero.id ? 'YOUR CHOSEN CLASS' : 'SELECT CLASS'}</span>
          </button>)}
        </div>
        <p className="tb-select-note">Type a gold word to use your special. Your host sets the rules. You can pick a new hero next game.</p>
      </section>
      <aside className="tb-select-ready" aria-label="Your hero and room">
        <div className="tb-select-preview" style={{'--hero-accent':selected.color} as React.CSSProperties}>
          <span className="tb-menu-card-label">YOUR HERO</span>
          <div className="tb-select-preview-stage"><CombatCharacter key={classId} classId={classId} color={selected.color} size={118}/></div>
          <h2>{selected.name}</h2><p>{selected.description}</p>
        </div>
        <form className="tb-select-join-form" onSubmit={event=>{event.preventDefault();if(canJoin && !busy)onJoin();}}>
          <span className="tb-menu-card-label"><span>02</span> JOIN YOUR PARTY</span>
          <div className="tb-select-name-row">
            <TextField fullWidth label="Player name" value={name} InputProps={{readOnly:true}} disabled={busy}/>
            <Tooltip title="Shuffle name"><IconButton aria-label="Shuffle name" disabled={busy} onClick={onShuffle}><ShuffleIcon/></IconButton></Tooltip>
          </div>
          <TextField fullWidth label="Session code" value={code} disabled={busy} onChange={event=>onCodeChange(event.target.value)}
            helperText="The three characters on your host's screen" inputProps={{maxLength:7,autoCapitalize:'characters',autoComplete:'off',spellCheck:false}}/>
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" className="tb-menu-primary" endIcon={<ArrowForwardIcon/>} disabled={busy || !canJoin}>{busy?'Joining your party...':'Join the battle'}</Button>
          <p className="tb-select-private-note">Your hero name is ready. No account needed.</p>
        </form>
      </aside>
    </div>
    <footer className="tb-menu-footer"><span>YOUR NEXT CHAPTER</span><span>Choose a hero. Type to attack. Win together.</span></footer>
  </MenuFrame>;
}
