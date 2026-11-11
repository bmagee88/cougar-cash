import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { submitTypingBossWords } from "./api";
import { attackWordLimit, consistencyMultiplier, effectiveDodgeChance, finishWord, requiresWordSpace, releaseAttack, typingAttackProgress, typingWord } from "./proportionalRules";
import { usePublishAttackProgress } from "./AttackProgress";
import { TypingBossCredentials, TypingBossSessionSnapshot, TypingBossTypingState, TypingBossWordResult } from "./types";
import "./continuousBattle.css";

const colors = { blue: "#7dd3fc", orange: "#fdba74", red: "#fda4af", green: "#86efac", gold: "#fde047" };
const goldAbilityText = {
  cleric: "Turn your attack into a heal for the lowest-HP wounded player.",
  barbarian: "Each perfect gold adds two words to this run. Type them to earn more damage and color bonuses. No gold damage multiplier or carryover.",
  necromancer: "Turn your attack into a revival for a knocked-out player.",
  monk: "Halve the next attack's word count per gold word, rounding up. It resets to ten unless you earn gold again.",
  paladin: "Turn your attack into a shield for an ally. It absorbs damage from one boss hit.",
  rogue: "Earn one extra roll per gold word for your next incoming hit.",
  dragon: "Ancient Red Dragon: each perfect gold adds two words to this run. Extra words can have their own colors and must be typed to count.",
};
const number = (value: number) => Number(value.toFixed(2)).toString();

export function ContinuousTyping({ sessionId, credentials, state, active }: {
  sessionId: string; credentials: TypingBossCredentials; state: TypingBossTypingState; active: boolean;
}) {
  const model = useRef({ ...state });
  const queue = useRef<TypingBossWordResult[]>([]);
  const acknowledged = useRef(state.nextWord);
  const inFlight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const wordDescriptionId = React.useId();
  const typed = useRef("");
  const completedText = useRef<Record<number, string>>({});
  const timing = useRef({ count: 0, sum: 0, squares: 0, last: null as number | null, transitionMs: undefined as number | undefined, gaps: [] as number[] });
  const publishProgress = usePublishAttackProgress(sessionId, credentials, active);
  const [, redraw] = useState(0);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const credentialsRef = useRef(credentials);
  credentialsRef.current = credentials;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, []);

  // A reconnect starts with an authoritative snapshot. Keep unacknowledged local words.
  useEffect(() => {
    if (state.nextWord < acknowledged.current || state.nextWord > model.current.nextWord) return;
    const next = { ...state };
    queue.current = queue.current.filter(record => record[0] >= state.nextWord);
    for (const [, text, count, sum, squares, transitionMs, gaps] of queue.current) {
      finishWord(next, text, count, sum, squares, transitionMs ?? undefined, gaps);
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
    if (!active || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    event.preventDefault();
    const current = model.current;
    const expectedWord = typingWord(current);
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
      const previousDodge = effectiveDodgeChance(current);
      const result = finishWord(current, typed.current, currentTiming.count, currentTiming.sum, currentTiming.squares, record[5] ?? undefined, record[6]);
      completedText.current[record[0]] = typed.current;
      queue.current.push(record);
      released = current.wordsInAttack === attackWordLimit(current);
      if (released) {
        releaseAttack(current, () => 1);
        completedText.current = {};
        // Rest between attacks is free; the first key starts a new clock.
        currentTiming.last = null;
      }
      typed.current = "";
      currentTiming.count = 0; currentTiming.sum = 0; currentTiming.squares = 0; currentTiming.transitionMs = undefined; currentTiming.gaps = [];
      if (released || (!current.balanced && (effectiveDodgeChance(current) !== previousDodge || (result.correct && result.color === "blue"))) || queue.current.length >= 20) flush();
    }
    publishProgress(current.nextWord, typed.current.length, typingAttackProgress(current, typed.current.length), released);
    redraw(value => value + 1);
  }

  const current = model.current;
  const word = typingWord(current);
  const multiplier = current.balanced ? current.characters ? (current.balancedPower || 0) / current.characters : current.balancedQuality || 1.25 : consistencyMultiplier(current.intervalCount + timing.current.count,
    current.intervalSum + timing.current.sum, current.intervalSquares + timing.current.squares);
  const cycleStart = current.nextWord - current.wordsInAttack;
  const rowWords = Array.from({ length: attackWordLimit(current) }, (_, offset) => typingWord(current, cycleStart + offset));
  const cursor = rowWords.slice(0, current.wordsInAttack).reduce((total, item) => total + item.text.length + 1, 0) + typed.current.length;

  return <Paper className="continuous-typing" elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: "1px solid #50627a", borderRadius: 2 }}>
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {multiplier !== 1 && <Chip label={`${current.balanced ? "Quality" : "Rhythm"} ×${multiplier.toFixed(2)}`} sx={{ color: "#e9d5ff" }} />}
      {current.balanced ? <>
        <Chip label={`Dodge readiness ${number(Math.min(100, 100 * (current.balancedGuard || 0) / (current.balancedGuardMax || 100)))}%`} sx={{ color:colors.green }} />
        {!!current.balancedGuard && <Chip label={`Guard ${number(current.balancedGuard)} HP`} sx={{ color:colors.blue }} />}
        <Chip label={`Special ${Math.min(100, 100 - ((current.balancedSpecialAt || 100) - (current.balancedCharacters || 0)))}/100`} sx={{ color:colors.gold }} />
      </> : <><Chip label={`Shield ${Math.round(current.shield * 100)}%`} sx={{ color: colors.blue }} />
      <Chip label={`Dodge ${number(100 * effectiveDodgeChance(current))}%`} sx={{ color: colors.green }} /></>}
      {!!current.dodgeExtraRolls && <Chip label={`${1 + current.dodgeExtraRolls} dodge rolls`} sx={{ color: colors.gold }} />}
      {!!current.paladinShield && <Chip label={`Golden shield ${number(current.paladinShield)} HP`} sx={{ color: colors.gold }} />}
      {!!current.gold && <Chip label={`Gold ×${current.gold}`} sx={{ color: colors.gold }} />}
      {(current.ability === "monk" || current.ability === "barbarian" || current.ability === "dragon") && <Chip label={`${current.wordsInAttack}/${attackWordLimit(current)} words this attack`} sx={{ color: colors.gold }} />}
      {current.orange + current.growth > 0 && <Chip label={`Attack +${Math.round((current.orange + current.growth) * 100)}%`} sx={{ color: colors.orange }} />}
      {current.red > 0 && <Chip label={`Crit ${Math.round(current.red * 100)}%`} sx={{ color: colors.red }} />}
      {current.green > 0 && <Chip label={`+${current.green * 4}% per correct word`} sx={{ color: colors.green }} />}
    </Stack>
    <Box onClick={() => input.current?.focus()} sx={{ mt: 2, position: "relative", cursor: active ? "text" : "default", border: `2px solid ${focused ? "#7dd3fc" : "#344256"}`, borderRadius: 2, p: 2, bgcolor: "#0b1220" }}>
      <span id={wordDescriptionId} hidden>{word.text}{word.color === "gold" && " — golden ability word"}</span>
      <Box sx={{ overflow: "hidden", my: 1, fontSize: { xs: 28, md: 36 }, fontFamily: "monospace", lineHeight: 1.5 }}>
        <Box key={cycleStart} data-testid="ten-word-row" aria-hidden="true" sx={{ whiteSpace: "pre", letterSpacing: 0, width: "max-content", transform: `translate3d(-${cursor}ch, 0, 0)`, transition: "transform 60ms linear", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}>
          {rowWords.map((item, offset) => {
            const index = cycleStart + offset;
            const text = index === current.nextWord ? typed.current : completedText.current[index] || "";
            return <span key={index} data-testid="typing-word" data-word-index={index}>{item.text.split("").map((letter, position) => {
              const done = index < current.nextWord || position < text.length;
              const wrong = position < text.length && text[position] !== letter;
              return <span key={position} style={{ color: wrong ? "#fda4af" : done ? "#64748b" : item.color ? colors[item.color] : "#f8fafc", fontWeight: item.color === "gold" ? 800 : undefined, textShadow: item.color === "gold" && !done ? "0 0 8px #f59e0b" : undefined, background: wrong ? "#7f1d1d" : undefined, borderBottom: index === current.nextWord && position === text.length ? "3px solid #fff" : "3px solid transparent" }}>{letter}</span>;
            })}<span style={{ borderBottom: index === current.nextWord && text.length === item.text.length ? "3px solid #fff" : "3px solid transparent" }}>{" "}</span></span>;
          })}
        </Box>
      </Box>
      <input ref={input} aria-label="Type the displayed word" aria-describedby={wordDescriptionId} value="" onChange={() => {}} disabled={!active} autoComplete="off" autoCapitalize="off" spellCheck={false}
        onKeyDown={keyDown} onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "text", width: "100%" }} />
    </Box>
    <Box component="details" sx={{ mt: 1, color: "text.secondary", fontSize: 13 }}>
      <Box component="summary" sx={{ cursor: "pointer", width: "fit-content" }}>Help</Box>
      {current.balanced && <Typography variant="body2" sx={{ mt:1 }}>Balanced: each correct character earns 1–1.25 power from key timing. Speed is counted through characters typed, not a second multiplier. Colors never multiply a run. Gold is earned every 100 correct characters; a perfect gold unlocks your ability. Special effects spend up to 20% of earned power. Unused healing/revival power stays damage. Blue and Rogue defense spend earned power, with no dodge dice; readiness describes stored guard capacity. Red marks a skill strike without double damage. Paladin shields persist until spent.</Typography>}
      <Typography variant="body2" sx={{ mt: 1 }}>
        Click the words to focus. Press space between words; the final word fires on its last letter. Correct letters and spaces add damage. Errors stay; backspace is disabled.
        Rest between attacks is free. {!current.balanced && "Rhythm allows 200 ms of timing variation."}
      </Typography>
      {!current.balanced && current.dodgeSamples && <Typography variant="body2" sx={{ mt: 1 }}>
        Start each new word promptly after Space to build up to 25% dodge. Your last five transitions are compared with your pace within those words. Rest between attacks does not count. A dodge avoids the entire hit and keeps your shield.
      </Typography>}
      {!current.balanced && <Typography variant="body2" sx={{ mt: 1 }}>
        30% colored words: perfect blue words block 10% of the next hit; orange adds 10% attack; red adds 10% crit chance; green adds 4% per following correct word.
        Bonuses stack. Attack bonuses reset when you fire; shields last until hit.
        {credentials.hostToken && " Dragon attacks: 60% Bite or Fireball targets one player, 30% Tail Whip targets a nearby group, and 10% Flamethrower targets everyone still standing. Damage splits evenly among targets before defenses."}
      </Typography>}
      {current.ability && <Typography variant="body2" sx={{ mt: 1 }}>
        {current.balanced ? "Master earned gold words to spend your class budget." : "Gold words appear 5% of the time. Type them perfectly to earn your ability."} {current.balanced && ["cleric","paladin","necromancer","rogue"].includes(current.ability) ? "Cleric heals, Necromancer revives, Paladin shields an ally, and Rogue banks defensive power. Each uses the same 20% budget." : goldAbilityText[current.ability]} A gold word extending a run needs Space even if it was previously the last word.
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
            <Typography sx={{ color: "#7dd3fc" }}>Dealt {number(player.totalDamage)} {dealt && <strong key={dealt.id} className="damage-flash">{dealt.evadeType === "dodge" ? "Dodged" : `+${number(dealt.amount || 0)}`}</strong>}</Typography>
            <Typography sx={{ color: "#fda4af" }}>Taken {number(player.totalTaken || 0)} {taken && <strong key={taken.id} className="damage-flash">{taken.evadeType === "dodge" ? "Dodged" : `−${number(taken.amount || 0)}`}</strong>}</Typography>
          </Stack>
        </Box>;
      })}
    </Box>
  </Paper>;
}
