import React from 'react';
import {Alert,Button,TextField} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MenuFrame from './MenuFrame';
import {TypingBossId,TypingBossMode} from './types';
import './hostSetup.css';

export interface HostBossChoice {
  id:TypingBossId;name:string;difficulty:string;hp:number;attackIntervalMs:number;color:string;description:string;image:string;
}
export default function HostSetup({bosses,bossId,onBossChange,mode,onModeChange,name,onNameChange,onCreate,busy,error}:{
  bosses:HostBossChoice[];bossId:TypingBossId;onBossChange:(id:TypingBossId)=>void;mode:TypingBossMode;
  onModeChange:(mode:TypingBossMode)=>void;name:string;onNameChange:(name:string)=>void;onCreate:()=>void;busy:boolean;error:string;
}) {
  const selected=bosses.find(boss=>boss.id===bossId) || bosses[0];
  return <MenuFrame className="tb-host-setup" backHref="/typing-boss" backLabel="Main menu">
    <header className="tb-host-heading">
      <div><p className="tb-menu-eyebrow"><span/> THE BATTLE BEGINS WITH YOU</p><h1>Set the <em>stage.</em></h1>
        <p className="tb-menu-intro">Choose your dragon. Name your battle. Bring your class together.</p></div>
      <span className="tb-host-unlocked"><LockOpenIcon fontSize="small"/> HOST ACCESS UNLOCKED</span>
    </header>
    <div className="tb-host-layout">
      <section className="tb-host-dragon-picker" aria-label="Choose your dragon">
        <div className="tb-host-arena" style={{'--dragon-accent':selected.color} as React.CSSProperties}>
          <div className="tb-host-arena-copy"><span className="tb-menu-card-label">YOUR DRAGON</span><h2>{selected.name}</h2>
            <p>{mode==='proportional'?'You are the boss. Your words fuel the fire.':selected.description}</p>
            <span className="tb-host-arena-rule">{mode==='proportional'?'100 HP per hero · Attacks powered by typing':`${selected.hp.toLocaleString()} HP · ${Math.round(selected.attackIntervalMs/1000)} second charge`}</span>
          </div>
          <div className="tb-host-dragon-glow"/>
          <img className="tb-host-dragon-art" key={selected.id} src={selected.image} alt={selected.name} draggable={false}/>
          <div className="tb-host-arena-caption">{mode==='proportional'?'THE CLASS VS. THE DRAGON':'THE ORIGINAL CLASSROOM QUEST'}</div>
        </div>
        <div className="tb-host-picker-label"><span className="tb-menu-card-label"><span>01</span> CHOOSE YOUR DRAGON</span><span>Three faces of fire.</span></div>
        <div className="tb-host-boss-cards">
          {bosses.map((boss,index)=><button key={boss.id} type="button" className={`tb-host-boss-card${bossId===boss.id?' tb-host-boss-selected':''}`}
            aria-pressed={bossId===boss.id} aria-label={boss.name} onClick={()=>onBossChange(boss.id)} disabled={busy}>
            <span className="tb-host-boss-number">0{index+1}</span>{bossId===boss.id && <CheckIcon className="tb-host-boss-check" fontSize="small"/>}
            <img src={boss.image} alt="" draggable={false}/><strong>{boss.name}</strong>
            <span>{mode==='old'?`${boss.difficulty.toUpperCase()} · ${boss.hp.toLocaleString()} HP`:['A spark of trouble.','Fire in its belly.','A legend with wings.'][index]}</span>
          </button>)}
        </div>
      </section>
      <form className="tb-host-config" onSubmit={event=>{event.preventDefault();if(name.trim() && !busy)onCreate();}}>
        <span className="tb-menu-card-label"><span>02</span> BUILD YOUR BATTLE</span>
        <h2>Make it yours.</h2><p>A name, a dragon, a room full of heroes.</p>
        <TextField fullWidth label="Game name" value={name} disabled={busy} onChange={event=>onNameChange(event.target.value)} inputProps={{maxLength:64}}/>
        <fieldset className="tb-host-modes"><legend>Battle mode</legend>
          <button type="button" aria-pressed={mode==='proportional'} disabled={busy} onClick={()=>onModeChange('proportional')}>
            <span className="tb-host-mode-dot"/><span><strong>Host vs. players</strong><small>You type as the dragon. The class fights back.</small></span>
          </button>
          <button type="button" aria-pressed={mode==='old'} disabled={busy} onClick={()=>onModeChange('old')}>
            <span className="tb-host-mode-dot"/><span><strong>Classic quiz battle</strong><small>Answer questions and use class moves.</small></span>
          </button>
        </fieldset>
        <div className="tb-host-next"><span>NEXT STOP: THE LOBBY</span><p>{mode==='proportional'?'Pick word levels, Balanced mode, and auto revive. Then share your room code.':'Share your room code and gather your heroes before you start.'}</p></div>
        {error && <Alert severity="error">{error}</Alert>}
        <Button className="tb-menu-primary" type="submit" variant="contained" disabled={busy || !name.trim()} endIcon={<ArrowForwardIcon/>}>{busy?'Creating your lobby...':'Create lobby'}</Button>
        <p className="tb-host-no-rush">Creating a room does not start the fight.</p>
        <a className="tb-host-join-link" href="/typing-boss/join">Playing instead? Join a battle <ArrowForwardIcon fontSize="small"/></a>
      </form>
    </div>
    <footer className="tb-menu-footer"><span>YOUR ROOM. YOUR RAID.</span><ol><li><b>1</b> Create a lobby</li><li><b>2</b> Invite your heroes</li><li><b>3</b> Start the battle</li></ol></footer>
  </MenuFrame>;
}
