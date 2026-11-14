import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { submitTypingBossWords } from "./api";
import { attackWordLimit, consistencyMultiplier, dodgeChance, effectiveDodgeChance, finishWord, requiresWordSpace, releaseAttack, typingAttackProgress, typingWord } from "./proportionalRules";
import { usePublishAttackProgress } from "./AttackProgress";
import { TypingBossCredentials, TypingBossSessionSnapshot, TypingBossTypingState, TypingBossWordResult } from "./types";
import "./continuousBattle.css";
import { combatFeedback, COMBAT_COLORS } from "./combatFeedback";
import TypingPortrait, { DragonPortrait, DragonPortraitProps, TypingPortraitProps } from "./TypingPortrait";
import { chargedLetters, WordReward, wordReward } from "./typingFeedback";
import { previewBalancedWord } from "./balancedRules";
import {useBattleCountdown} from "./BattleCountdown";
import TeamActivityCue from './TeamActivityCue';

const colors = { blue: "#7dd3fc", orange: "#fdba74", red: "#ff6b6b", green: "#86efac", gold: "#fde047" };
const goldAbilityText = {
  cleric: "Turn your attack into a heal for the lowest-HP wounded player.",
  barbarian: "Each perfect gold adds two words to this run. Type them to earn more damage and color bonuses. No gold damage multiplier or carryover.",
  necromancer: "Turn your attack into a revival for a knocked-out player.",
  monk: "Halve the next attack's word count per gold word, rounding up. It resets to ten unless you earn gold again.",
  paladin: "Turn your attack into Block for an ally. It absorbs damage from one boss hit.",
  rogue: "Earn one extra roll per gold word for your next incoming hit.",
  dragon: "Dragon: each perfect gold adds two words to this run. Extra words can have their own colors and must be typed to count.",
};
const number = (value: number) => Number(value.toFixed(2)).toString();
function mergeWordWindows(a: TypingBossTypingState['issuedWords'], b: TypingBossTypingState['issuedWords'], start:number) {
  if(!a && !b)return undefined;
  return [...new Map([...(a || []),...(b || [])].map(word=>[word.index,word])).values()].filter(word=>word.index>=start);
}

function WordRewardBurst({ reward, onDone }: { reward: WordReward; onDone: (id: number) => void }) {
  useEffect(() => {
    // Also removes the notice when reduced motion disables its CSS animation.
    const timer = window.setTimeout(() => onDone(reward.id), 1100);
    return () => window.clearTimeout(timer);
  }, [reward.id, onDone]);
  return <div className="typing-word-reward" data-testid="word-reward" data-bonus={reward.bonus}
    style={{ color: reward.color }} onAnimationEnd={event => { if (event.target === event.currentTarget) onDone(reward.id); }}>
    <strong>{reward.word} {reward.correct ? "✓" : "·"}</strong><span>{reward.label}</span>
  </div>;
}

export function ContinuousTyping({ sessionId, credentials, state, active, profile, dragonProfile, hostProfile, healingPool=0, countdownEndsAt, serverNow, teamActivity }: {
  sessionId: string; credentials: TypingBossCredentials; state: TypingBossTypingState; active: boolean; profile?: TypingPortraitProps; dragonProfile?: DragonPortraitProps; hostProfile?: DragonPortraitProps; healingPool?:number; countdownEndsAt?:number|null; serverNow?:number;teamActivity?:TypingBossSessionSnapshot['teamActivity'];
}) {
  const seconds=useBattleCountdown(countdownEndsAt,serverNow),canType=active && seconds===0;
  const model = useRef({ ...state });
  const queue = useRef<TypingBossWordResult[]>([]);
  const acknowledged = useRef(state.nextWord);
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const wordDescriptionId = React.useId();
  const typed = useRef("");
  const awaitingSpace = useRef(false);
  const completedText = useRef<Record<number, string>>({});
  const timing = useRef({ count: 0, sum: 0, squares: 0, mistakes:0, last: null as number | null, transitionMs: undefined as number | undefined, gaps: [] as number[] });
  const publishProgress = usePublishAttackProgress(sessionId, credentials, canType);
  const [, redraw] = useState(0);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [keyNotice,setKeyNotice] = useState('');
  const [rewards, setRewards] = useState<WordReward[]>([]);
  const clearReward = React.useCallback((id: number) => setRewards(items => items.filter(item => item.id !== id)), []);
  const credentialsRef = useRef(credentials);
  credentialsRef.current = credentials;
  const activeRef = useRef(canType);
  activeRef.current = canType;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, []);

  // A reconnect starts with an authoritative snapshot. Keep unacknowledged local words.
  useEffect(() => {
    if (state.nextWord < acknowledged.current || state.nextWord > model.current.nextWord) return;
    const next = { ...state,issuedWords:mergeWordWindows(model.current.issuedWords,state.issuedWords,state.nextWord-state.wordsInAttack) };
    queue.current = queue.current.filter(record => record[0] >= state.nextWord);
    for (const [, text, count, sum, squares, transitionMs, gaps,proof] of queue.current) {
      finishWord(next, text, count, sum, squares, transitionMs ?? undefined, gaps,proof?.mistakes || 0);
      if (next.wordsInAttack === attackWordLimit(next)) releaseAttack(next, () => 1);
    }
    acknowledged.current = Math.max(acknowledged.current, state.nextWord);
    if (!queue.current.length) setError("");
    model.current = next;
    redraw(value => value + 1);
  }, [state]);

  async function flush() {
    if (inFlight.current || !queue.current.length || !activeRef.current || !mounted.current) return;
    inFlight.current = true;
    const batch = queue.current.slice(0, 20);
    try {
      const result = await submitTypingBossWords(sessionId, credentialsRef.current, batch);
      if (!mounted.current) return;
      acknowledged.current = Math.max(acknowledged.current, result.nextWord);
      queue.current = queue.current.filter(record => record[0] >= result.nextWord);
      if(result.issuedWords) {
        const current=model.current;
        current.issuedWords=mergeWordWindows(current.issuedWords,result.issuedWords,current.nextWord-current.wordsInAttack);
        redraw(value=>value+1);
      }
      setError("");
    } catch (caught) {
      if (!mounted.current || !activeRef.current) return;
      setError(caught instanceof Error ? caught.message : "Your words are waiting to reconnect.");
      retryTimer.current = setTimeout(() => { retryTimer.current = null; flush(); }, 1500);
    } finally {
      inFlight.current = false;
    }
    // Words can finish while the request is in flight. A blue shield must not wait.
    if (queue.current.length && !retryTimer.current && mounted.current) flush();
  }

  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab") return;
    if (event.key === "Backspace" || event.key === "Delete" || event.key === "Enter") {
      event.preventDefault(); return;
    }
    if (!canType || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    event.preventDefault();
    const current = model.current;
    const scheduled=current.balanced && !current.balancedRandomColors;
    if(scheduled && awaitingSpace.current) {
      if(event.key===' ') {
        awaitingSpace.current=false;
        timing.current.last=event.nativeEvent.timeStamp;
      }
      return;
    }
    // A separator after the final word must not become the next attack's typo.
    if(scheduled && !typed.current.length && event.key===' ')return;
    const expectedWord = typingWord(current);
    if(expectedWord.pending)return;
    if(current.wordProtocol===1 && event.key!==(expectedWord.text+' ')[typed.current.length]) {
      timing.current.mistakes++;
      setKeyNotice('Type the highlighted letter to continue. Earned power is safe.');
      return;
    }
    setKeyNotice('');
    // All letter positions must be entered, followed by the required space.
    if (typed.current.length === expectedWord.text.length && event.key !== " ") return;
    // Native event timestamps measure the key event, not a delayed React handler.
    const timestamp = event.nativeEvent.timeStamp;
    const now = Number.isFinite(timestamp) ? timestamp : performance.now();
    const currentTiming = timing.current;
    if (currentTiming.last !== null) {
      const interval = Math.max(0, now - currentTiming.last);
      if (!typed.current.length && current.wordsInAttack !== 0 && current.dodgeSamples) {
        currentTiming.transitionMs = interval;
      }
      if (current.balanced) currentTiming.gaps.push(interval);
      currentTiming.count += 1;
      currentTiming.sum += interval;
      currentTiming.squares += interval * interval;
    }
    currentTiming.last = now;
    typed.current += event.key;
    let released = false;
    if (typed.current.length === expectedWord.text.length + (requiresWordSpace(current, typed.current) ? 1 : 0)) {
      const record: TypingBossWordResult = [current.nextWord, typed.current, currentTiming.count, currentTiming.sum, currentTiming.squares];
      if (current.balanced) { record[5] = currentTiming.transitionMs ?? null; record[6] = [...currentTiming.gaps]; }
      else if (currentTiming.transitionMs !== undefined) record[5] = currentTiming.transitionMs;
      if(current.wordProtocol===1) {
        record[5]=currentTiming.transitionMs ?? null;record[6]=current.balanced?[...currentTiming.gaps]:null;
        record[7]={ticket:expectedWord.ticket!,mistakes:currentTiming.mistakes};
      }
      const previousDodge = effectiveDodgeChance(current);
      const before = { ...current };
      const result = finishWord(current, typed.current, currentTiming.count, currentTiming.sum, currentTiming.squares, record[5] ?? undefined, record[6],record[7]?.mistakes || 0);
      const reward = wordReward(before, current, expectedWord.text, result.correct, result.color);
      setRewards([reward]);
      completedText.current[record[0]] = typed.current;
      queue.current.push(record);
      released = current.wordsInAttack === attackWordLimit(current);
      if (released) {
        releaseAttack(current, () => 1);
        completedText.current = {};
        // Rest between attacks is free; the first key starts a new clock.
        currentTiming.last = null;
      }
      if(scheduled)awaitingSpace.current=!released;
      typed.current = "";
      currentTiming.count = 0; currentTiming.sum = 0; currentTiming.squares = 0; currentTiming.mistakes=0; currentTiming.transitionMs = undefined; currentTiming.gaps = [];
      if (current.wordProtocol===1 || scheduled || released || effectiveDodgeChance(current) !== previousDodge || (result.correct && result.color === "gold") || (current.balanced && result.correct && (result.color === "red" || result.color === "blue" || (result.color==='orange' && current.ability==='cleric'))) || (!current.balanced && result.correct && result.color === "blue") || queue.current.length >= 20) flush();
    }
    publishProgress(current.nextWord, typed.current.length, typingAttackProgress(current, typed.current.length), released);
    redraw(value => value + 1);
  }

  const current = model.current;
  const scheduled=current.balanced && !current.balancedRandomColors;
  const word = typingWord(current);
  const live = current.balanced ? previewBalancedWord(current,typed.current,word.text+" ",timing.current.gaps,word.color) : current;
  const multiplier = scheduled ? 1+(live.balancedCadenceBonus || 0) : current.balanced ? current.characters ? Math.max(0,current.balancedPower || 0) / current.characters : current.balancedQuality || 1.25 : consistencyMultiplier(current.intervalCount + timing.current.count,
    current.intervalSum + timing.current.sum, current.intervalSquares + timing.current.squares);
  const blockPreview=Math.min(current.balancedGuardMax || 100,(current.balancedGuard || 0)+(live.balancedBlockBank || 0));
  const profileState=scheduled ? current : current.balanced ? {...current,balancedGuard:blockPreview} : current;
  const cycleStart = current.nextWord - current.wordsInAttack;
  // Reveal the extension on the gold word's last correct letter. The separator
  // still commits the word normally; finishWord then owns the same two slots.
  // This is display-only, so snapshots/retries cannot award the ability twice.
  const previewExtension = (current.ability === "barbarian" || current.ability === "dragon") && word.color === "gold" && typed.current === word.text && timing.current.mistakes===0;
  const rowWords = Array.from({ length: attackWordLimit(current) + (previewExtension ? 2 : 0) }, (_, offset) => typingWord(current, cycleStart + offset));
  const cursor = rowWords.slice(0, current.wordsInAttack).reduce((total, item) => total + item.text.length + 1, 0) + typed.current.length;

  return <Paper className="continuous-typing" elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: "1px solid #50627a", borderRadius: 2 }}>
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {(scheduled || multiplier !== 1) && <Chip label={`${scheduled ? "Cadence" : current.balanced ? "Quality" : "Rhythm"} ×${multiplier.toFixed(scheduled ? 4 : 2)}`} sx={{ color: "#e9d5ff" }} />}
      {scheduled && <Chip label={`ATK ${number(chargedLetters(current,typed.current))}`} />}
      {current.balanced ? <>
        {!scheduled && <Chip title={`Banked Dodge points · next hit: ${number(effectiveDodgeChance(current) * 100)}% chance`} label={`Dodge ${number(dodgeChance(current))}`} sx={{ color:colors.green }} />}
        {!scheduled && <Chip label={`Block ${number(blockPreview + (current.paladinShield || 0))}`} sx={{ color:colors.blue }} />}
        {scheduled && <Chip label={`${current.ability==='cleric'?'Prayer ready':'Extra attack'} +${number((current.ability==='cleric'?current.balancedHealingDeposit:current.balancedOrangePower) || 0)}`} sx={{color:colors.orange}}/>}
        {scheduled && <Chip label={`Crit +${number((current.balancedCritBonus || 0)*100)}%`} sx={{color:colors.red}}/>}
        <Chip label={`${current.ability==='cleric'?'Prayer':'Charge'} +${number((current.ability==='cleric'?live.balancedHealingBank:live.balancedOrangeBank) || 0)}`} sx={{ color:current.ability==='cleric'?'#facc15':colors.orange }} />
        {current.ability==='cleric' && <Chip label={`Prayer pool ${number(healingPool)}`} sx={{color:'#facc15'}}/>}
        <Box sx={{ minWidth: 110, alignSelf: "center", color: colors.red }}>
          <Typography variant="caption">Crit charge +{number(live.balancedCritCharge || 0)}%</Typography>
          {!current.balancedRandomColors && <LinearProgress aria-label="Crit power charge" variant="determinate" value={Math.max(0, Math.min(100, 100 * (1 - ((current.balancedCritAt || 134) - (live.balancedCharacters || 0)) / 134)))} sx={{ bgcolor: "#4c1525", "& .MuiLinearProgress-bar": { bgcolor: colors.red } }} />}
        </Box>
      </> : <><Chip label={`Block ${Math.round(current.shield * 100)}%`} sx={{ color: colors.blue }} />
      <Chip title={`Banked Dodge points · next hit: ${number(effectiveDodgeChance(current) * 100)}% chance`} label={`Dodge ${number(dodgeChance(current))}`} sx={{ color: colors.green }} /></>}
      {!scheduled && !!current.dodgeExtraRolls && <Chip label={`${1 + current.dodgeExtraRolls} dodge rolls`} sx={{ color: colors.gold }} />}
      {!current.balanced && !!current.paladinShield && <Chip label={`Block ${number(current.paladinShield)} HP`} sx={{ color: colors.gold }} />}
      {credentials.hostToken && !!current.gold && <Chip label={`Gold ×${current.gold}`} sx={{ color: colors.gold }} />}
      {current.red > 0 && <Chip label={`Crit ${Math.round(current.red * 100)}%`} sx={{ color: colors.red }} />}
      {current.green > 0 && <Chip label={`+${current.green * 4}% per correct word`} sx={{ color: colors.green }} />}
    </Stack>
    {teamActivity && <TeamActivityCue activity={teamActivity} />}
    <div className={profile || hostProfile ? `typing-input-deck${dragonProfile ? " typing-input-deck-dual" : ""}` : undefined}>
    {hostProfile && <DragonPortrait {...hostProfile} state={profileState} letters={chargedLetters(current,typed.current)}/>}
    {profile && <TypingPortrait {...profile} state={profileState} letters={chargedLetters(current, typed.current)} />}
    <Box className="typing-word-input" onClick={() => input.current?.focus()} sx={{ mt: 2, position: "relative", cursor: active ? "text" : "default", border: `2px solid ${focused ? "#7dd3fc" : "#344256"}`, borderRadius: 2, p: 2, bgcolor: "#0b1220" }}>
      <div className="typing-word-rewards" aria-hidden="true">{rewards.map(reward => <WordRewardBurst key={reward.id} reward={reward} onDone={clearReward} />)}</div>
      <span id={wordDescriptionId} hidden>{word.text}{word.color === "gold" && " — golden ability word"}{word.trigger && word.color!=="gold" && ` — ${word.color} bonus trigger word`}{!scheduled && current.balanced && word.color === "red" && " — critical attack trigger word"}</span>
      <Box sx={{ overflow: "hidden", my: 1, fontSize: { xs: 28, md: 36 }, fontFamily: "monospace", lineHeight: 1.5 }}>
        <Box key={cycleStart} data-testid="ten-word-row" aria-hidden="true" sx={{ whiteSpace: "pre", letterSpacing: 0, width: "max-content", transform: `translate3d(-${cursor}ch, 0, 0)`, transition: "transform 60ms linear", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
          {rowWords.map((item, offset) => {
            const index = cycleStart + offset;
            const prayerWord=current.balanced && current.ability==="cleric" && item.color==="orange";
            const text = index === current.nextWord ? typed.current : completedText.current[index] || "";
            const glowing=scheduled ? item.trigger : item.color==='gold' || item.color==='red';
            return <span key={index} data-testid="typing-word" data-word-index={index} data-trigger={Boolean(glowing)}>{item.text.split("").map((letter, position) => {
              const done = index < current.nextWord || position < text.length;
              const wrong = position < text.length && text[position] !== letter;
              return <span key={position} style={{ color: wrong ? "#fda4af" : done ? "#64748b" : prayerWord ? "#facc15" : item.color ? colors[item.color] : "#f8fafc", fontWeight: glowing ? 800 : undefined, textShadow: !done && glowing && item.color ? `0 0 8px ${prayerWord ? '#facc15' : colors[item.color]}` : 'none', background: wrong ? "#7f1d1d" : undefined, borderBottom: index === current.nextWord && position === text.length ? "3px solid #fff" : "3px solid transparent" }}>{letter}</span>;
            })}<span style={{ borderBottom: index === current.nextWord && text.length === item.text.length ? "3px solid #fff" : "3px solid transparent" }}>{" "}</span></span>;
          })}
        </Box>
      </Box>
      <input ref={input} aria-label="Type the displayed word" aria-describedby={wordDescriptionId} value="" onChange={() => {}} disabled={!canType} autoComplete="off" autoCapitalize="off" spellCheck={false}
        onKeyDown={keyDown} onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "text", width: "100%" }} />
    </Box>
    {dragonProfile && <DragonPortrait {...dragonProfile} />}
    </div>
    {(keyNotice || word.pending) && <Typography role="status" sx={{mt:1,color:'#facc15'}}>{word.pending ? 'Loading the next words…' : keyNotice}</Typography>}
    <Box component="details" sx={{ mt: 1, color: "text.secondary", fontSize: 13 }}>
      <Box component="summary" sx={{ cursor: "pointer", width: "fit-content" }}>Help</Box>
      <Typography variant="body2">Correct letters earn attack power. Mistakes earn nothing and never subtract earned ATK or drain saved color banks. A bonus trigger still requires a fully correct word. Cadence and rhythm can add power, never reduce base damage.</Typography>
      {current.balanced && current.balancedRandomColors && <Typography variant="body2">Random colors: white 40%, orange 20%, blue 18%, green 15%, crit 4%, special 3%. Charge and crit banks still accumulate; perfect colored words activate bonuses. Colors are fixed for each generated word.</Typography>}
      {current.balanced && !scheduled && <Typography variant="body2" sx={{mt:1}}>White words build ATK. Orange words build Charge (yellow Prayer for Clerics); blue builds Block; red builds crit; green earns Dodge from smooth word transitions. Each character builds only its color category. Perfect colored words confirm their bonus immediately. Blue Block never waits for attack release. Special words activate class abilities. Mistakes never drain saved power.</Typography>}
      {scheduled && <Typography variant="body2" sx={{mt:1}}>All colors build ATK. Red banks crit, blue banks Block, orange banks extra attack (Prayer for Clerics), and green banks Dodge. Glowing triggers activate saved power. Block builds at half the former rate. Cadence rewards low deviation from each word’s running mean, adds to this attack at release, and resets with the next attack. Dodge measures Space-to-first-letter smoothness against the new word’s letter pace, banking up to half a point per perfect green word. Banked defense has no active visual until triggered.</Typography>}
      <Typography variant="body2" sx={{ mt: 1 }}>
        Click the words to focus. Press space between words; the final word fires on its last letter. {scheduled ? "Correct letters add damage; each word commits on its last letter. Space moves to the next word." : "Correct letters and spaces add damage."} {current.wordProtocol===1 ? "Wrong keys keep the cursor in place; backspace is disabled." : "Errors stay; backspace is disabled."}
        Rest between attacks is free. {!current.balanced && "Rhythm allows 200 ms of timing variation."}
      </Typography>
      {!scheduled && current.dodgeSamples && <Typography variant="body2" sx={{ mt: 1 }}>
        Start each new word promptly after Space to bank up to 1 Dodge point per transition, with no storage cap. Smooth transitions earn more; slower transitions never remove saved dodge. Banked points give up to a 100% dodge chance. A successful dodge avoids the entire incoming hit, spends 100 points (minimum zero), and keeps your Block. Rest between attacks does not count.
      </Typography>}
      {!current.balanced && <Typography variant="body2" sx={{ mt: 1 }}>
        30% colored words: perfect blue words block 10% of the next hit; orange adds 10% attack; red adds 10% crit chance; green adds 4% per following correct word.
        Bonuses stack. Attack bonuses reset when you fire; Block lasts until hit.
        {credentials.hostToken && " Dragon attacks: 60% Bite or Fireball targets one player, 30% Tail Whip targets a nearby group, and 10% Flamethrower targets everyone still standing. Damage splits evenly among targets before defenses."}
      </Typography>}
      {current.ability && <Typography variant="body2" sx={{ mt: 1 }}>
        {current.balanced ? "Master earned gold words to activate your class ability." : "Gold words appear 5% of the time. Type them perfectly to earn your ability."} {current.balanced && current.ability==='cleric' ? "Prayer replaces Charge. Yellow words build Prayer and ATK in scheduled mode; mistakes preserve saved Prayer. Perfect yellow triggers deposit the saved amount into the shared Prayer pool. On attack release, a gold special heals a random wounded living player, up to attack power and missing HP. Surplus stays in the pool. The team can heal back at most half the HP damage actually dealt by the dragon. Base attack power remains damage." : current.balanced && ["paladin","necromancer","rogue"].includes(current.ability) ? "Necromancer revives and Paladin gives an ally Block using the 20% support budget. Rogue specials add extra dodge rolls." : goldAbilityText[current.ability]} {scheduled ? "Gold extensions commit on the last letter." : "A gold word extending a run needs Space even if it was previously the last word."}
      </Typography>}
    </Box>
    {error && <Alert severity="warning" sx={{ mt: 1 }}>{error} Your completed words will retry automatically. <Button onClick={flush}>Retry</Button></Alert>}
  </Paper>;
}

export function DamageBoard({ session, personal = false }: { session: TypingBossSessionSnapshot; personal?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  useEffect(() => { if (session.serverNow) offset.current = session.serverNow - Date.now(); }, [session.serverNow]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
  const hits = session.projectiles.filter(item => (item.kind === "damage" || item.kind === "boss") && item.resolvedAt && now + offset.current - item.resolvedAt < 4500).slice().reverse();
  return <Paper elevation={0} sx={{ p: 2, border: "1px solid #31394a", borderRadius: 2 }}>
    <Typography variant="h6" fontWeight={900}>{personal ? "Your damage" : "All player damage"}</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: personal ? "1fr" : { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1, mt: 1 }}>
      {session.players.map(player => {
        const dealt = hits.find(hit => hit.source === player.code);
        const taken = hits.find(hit => hit.target === player.code);
        return <Box key={player.code} sx={{ border: "1px solid #344256", borderRadius: 1, px: 1.5, py: 1, minWidth: 0, bgcolor: player.defeated ? "#28151f" : "#101a2a" }}>
          <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={900} noWrap>{player.name}</Typography><Typography variant="body2" whiteSpace="nowrap">{number(player.hp)} / {number(player.maxHp)} HP</Typography></Stack>
          <Stack direction="row" gap={2} sx={{ mt: 0.5 }}>
            <Typography sx={{ color: COMBAT_COLORS.damage }}>Dealt {number(player.totalDamage)} {dealt && <strong key={dealt.id} className="damage-flash" style={{ color: combatFeedback(dealt).color }}>{combatFeedback(dealt).label}</strong>}</Typography>
            <Typography sx={{ color: COMBAT_COLORS.damage }}>Taken {number(player.totalTaken || 0)} {taken && <strong key={taken.id} className="damage-flash" style={{ color: combatFeedback(taken).color }}>{combatFeedback(taken).label}</strong>}</Typography>
          </Stack>
        </Box>;
      })}
    </Box>
  </Paper>;
}
