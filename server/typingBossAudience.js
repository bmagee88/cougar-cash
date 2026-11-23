// Public combat is shared; appServer attaches only the recipient's private typing state.
function studentView(snapshot,code) {
  const teammates=snapshot.players.filter(player=>player.code!==code);
  const total=key=>teammates.reduce((sum,player)=>sum+(player[key] || 0),0);
  return {snapshot:{...snapshot,battleView:'full',
    teamActivity:{damage:total('totalDamage'),healing:total('totalHealing'),revives:total('totalResurrections')},
  }};
}
module.exports={studentView};
