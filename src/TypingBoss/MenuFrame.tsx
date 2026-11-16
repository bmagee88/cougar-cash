import React from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './mainMenu.css';

const ASSETS=`${(process.env.PUBLIC_URL || '').replace(/\/$/,'')}/assets/typing-boss`;
export default function MenuFrame({children,className='',backHref='/',backLabel='Tech Lab'}:{children:React.ReactNode;className?:string;backHref?:string;backLabel?:string}) {
  return <main className={`tb-menu ${className}`} style={{'--menu-landscape':`url("${ASSETS}/volcanic-valley-arena.png")`} as React.CSSProperties}>
    <div className="tb-menu-inner">
      <header className="tb-menu-nav">
        <a className="tb-menu-brand" href="/typing-boss"><span className="tb-menu-mark" aria-hidden="true">TB</span><span>Typing Boss<span className="tb-menu-brand-caption">THE CLASSROOM RAID</span></span></a>
        <a className="tb-menu-back" href={backHref}><ArrowBackIcon fontSize="small"/> {backLabel}</a>
      </header>
      {children}
    </div>
  </main>;
}
