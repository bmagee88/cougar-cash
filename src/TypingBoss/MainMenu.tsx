import React from 'react';
import {Button} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuFrame from './MenuFrame';
import './mainMenu.css';

const ASSETS=`${(process.env.PUBLIC_URL || '').replace(/\/$/,'')}/assets/typing-boss`;

export default function MainMenu({children}:{children:React.ReactNode}) {
  return <MenuFrame>
      <section className="tb-menu-hero" aria-labelledby="tb-menu-title">
        <div className="tb-menu-hero-copy">
          <p className="tb-menu-eyebrow"><span/> GATHER YOUR PARTY</p>
          <h1 id="tb-menu-title">Small keys.<br/>Epic <em>battles.</em></h1>
          <p className="tb-menu-intro">A dragon. A classroom of heroes.<br/>Every word brings you closer to victory.</p>
          <div className="tb-menu-hero-actions">
            <Button href="/typing-boss/join" variant="contained" className="tb-menu-primary" endIcon={<ArrowForwardIcon/>}>Join a battle</Button>
            <a className="tb-menu-host-link" href="#host-battle">Hosting? Set the stage <ArrowForwardIcon fontSize="small"/></a>
          </div>
          <div className="tb-menu-facts"><span>UP TO <b>30</b> HEROES</span><i/><span><b>6</b> CLASSES</span><i/><span>ONE SHARED BATTLE</span></div>
        </div>
        <div className="tb-menu-dragon-stage" aria-hidden="true">
          <div className="tb-menu-dragon-halo"/>
          <img className="tb-menu-dragon" src={`${ASSETS}/ancient-red-dragon-sprite.png`} alt="" draggable={false}/>
          <div className="tb-menu-boss-caption"><span>YOUR NEXT CHALLENGE</span><strong>The Ancient Red Dragon</strong></div>
        </div>
      </section>
      <section className="tb-menu-paths" aria-label="Choose how to play">
        <article className="tb-menu-student-card">
          <span className="tb-menu-card-label"><span>01</span> FOR STUDENTS</span>
          <h2>Your party needs you.</h2>
          <p>Bring your room code. Choose your hero.<br/>Make every keystroke count.</p>
          <Button href="/typing-boss/join" className="tb-menu-student-link" endIcon={<ArrowForwardIcon/>}>Choose your character</Button>
          <div className="tb-menu-keycaps" aria-hidden="true"><kbd>W</kbd><kbd>O</kbd><kbd>R</kbd><kbd>D</kbd><span>=</span><span className="tb-menu-key-spark">✦</span></div>
        </article>
        <article id="host-battle" className="tb-menu-host-card">
          <span className="tb-menu-card-label"><span>02</span> FOR TEACHERS</span>
          <h2>Lead the raid.</h2>
          <p>Unlock room creation, choose your dragon,<br/>and invite the whole class.</p>
          {children}
        </article>
      </section>
      <footer className="tb-menu-footer"><span>THE QUEST IS SIMPLE</span><ol><li><b>1</b> Choose a hero</li><li><b>2</b> Type to attack</li><li><b>3</b> Win together</li></ol><a href="/typing-boss/animations">Preview animations</a></footer>
  </MenuFrame>;
}
