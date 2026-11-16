function validEntry(session, entry) {
  return session.players.get(entry.player.code) === entry.player && entry.player.hp <= 0 && entry.player.knockouts === entry.knockout;
}

function clearEntry(session,entry) {
  clearTimeout(entry.timer);
  session.timers?.delete(entry.timer);
  if(entry.player.knockouts===entry.knockout) {
    entry.player.recoverAt=null;entry.player.recoverDurationMs=null;
  }
}

function cancelRecovery(session) {
  if(!session.recovery)return;
  for(const entry of session.recovery.entries.values())clearEntry(session,entry);
  session.recovery=null;
}

function syncRecovery(session) {
  const state=session.recovery;
  if(!state)return;
  if(session.status!=='active' || session.autoRevive===false){cancelRecovery(session);return;}
  for(const [code,entry] of state.entries) {
    if(!validEntry(session,entry)) {clearEntry(session,entry);state.entries.delete(code);}
  }
  if(!state.entries.size)session.recovery=null;
}

function knockOutMany(session,players,callbacks) {
  const batch=[...new Set(players)],now=Date.now();
  const random=callbacks.random || Math.random;
  // Randomize only simultaneous KOs, assigning each its next global delay.
  for(let i=batch.length-1;i>0;i--) {
    const j=Math.min(i,Math.floor(random()*(i+1)));
    [batch[i],batch[j]]=[batch[j],batch[i]];
  }
  for(const player of batch) {
    const priorKOs=session.teamKnockouts || 0;
    session.teamKnockouts=priorKOs+1;
    player.knockouts=(player.knockouts || 0)+1;
    player.recoverAt=null;player.recoverDurationMs=null;
    if(session.status!=='active' || session.autoRevive===false)continue;
    const state=session.recovery || (session.recovery={entries:new Map()});
    const previous=state.entries.get(player.code);
    if(previous)clearEntry(session,previous);
    const duration=10000+session.players.size*3000+priorKOs*3000;
    const entry={player,knockout:player.knockouts,deadline:now+duration,duration,timer:null};
    state.entries.set(player.code,entry);
    player.recoverAt=entry.deadline;player.recoverDurationMs=duration;
    entry.timer=callbacks.schedule(session,()=>{
      if(session.recovery!==state || state.entries.get(player.code)!==entry)return;
      if(session.status!=='active' || session.autoRevive===false){cancelRecovery(session);return;}
      if(validEntry(session,entry))player.hp=1;
      clearEntry(session,entry);state.entries.delete(player.code);
      if(!state.entries.size)session.recovery=null;
      callbacks.broadcast(session);
    },Math.max(0,entry.deadline-Date.now()));
  }
  if(session.status!=='active' || session.autoRevive===false)cancelRecovery(session);
}

function knockOut(session,player,callbacks) {knockOutMany(session,[player],callbacks);}
module.exports={knockOut,knockOutMany,syncRecovery,cancelRecovery};
