import { useCallback, useEffect, useRef, useState } from 'react';
import { BALANCE } from './engine/config';
import { cast, createTyping, tick, triggerBite, typeKey } from './engine/game';
import { awardCatch, awardEscape, persistSave, readSave } from './engine/storage';
import { EncounterOverrides, FishCheck, FishingConditions, GameState, SaveData } from './engine/types';

export function useFishingGame(conditions: (save: SaveData) => FishingConditions) {
  const [game, setGame] = useState<GameState>({ phase: 'idle' });
  const [save, setSave] = useState(readSave);
  const [storageError, setStorageError] = useState(false);
  const [checks,setChecks]=useState<FishCheck[]>([]);
  const inspected=useRef<FishCheck | undefined>(undefined);
  const gameRef = useRef(game); const saveRef = useRef(save); const ready = useRef(false);
  const conditionsRef = useRef(conditions); conditionsRef.current = conditions;
  const overrides = useRef<EncounterOverrides>({});
  const updateSave = useCallback((change: (s: SaveData) => SaveData) => {
    const next = change(saveRef.current);
    saveRef.current = next; setSave(next); setStorageError(!persistSave(next));
  }, []);
  const commit = useCallback((next: GameState) => {
    const prev = gameRef.current;
    if (prev === next) return;
    if (process.env.NODE_ENV==='development' && next.check && next.check!==inspected.current) {
      inspected.current=next.check;const check=next.check;setChecks(history=>[check,...history].slice(0,40));
    }
    if (next.phase === 'typing' && prev.phase !== 'typing') ready.current = false;
    gameRef.current = next; setGame(next);
    if (next.phase === 'landing' && prev.phase !== 'landing') updateSave(s => awardCatch(s, next.encounter, next.performance));
    if (next.phase === 'result' && next.outcome === 'escaped' && prev.phase !== 'result') updateSave(s => awardEscape(s, next.performance));
  }, [updateSave]);
  const armChallenge = useCallback(() => {
    const current = gameRef.current;
    if (current.phase === 'typing' && !ready.current) {
      ready.current = true;
      commit({ ...current, typing: createTyping(current.encounter.phrase, performance.now()) });
    }
  }, [commit]);
  useEffect(() => {
    let frame: number;
    const advance = () => {
      const state = gameRef.current;
      if (state.phase === 'typing' && !ready.current) return;
      const now = performance.now();
      // Sample absolute time at the bite itself, including a just-crossed season
      // or moon boundary, rather than the last rendered clock tick.
      const biteConditions = state.phase === 'retrieving' || ((state.phase === 'casting' || state.phase === 'waiting') && now >= state.biteAt) ? conditionsRef.current(saveRef.current) : undefined;
      commit(tick(state, now, Math.random, process.env.NODE_ENV === 'development' ? overrides.current : {}, biteConditions,process.env.NODE_ENV==='development'));
    };
    const animate = () => {
      advance();
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    // Hidden tabs still expire by the original monotonic deadline on returning.
    const visible = () => { if (document.visibilityState === 'visible') advance(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visible); };
  }, [commit]);
  const castLine = useCallback(() => {
    if (saveRef.current.livewell.length < BALANCE.livewellCapacity) commit(cast(gameRef.current, performance.now(), Math.random, conditionsRef.current(saveRef.current),saveRef.current.settings.fishingMode));
  }, [commit]);
  const key = useCallback((keyValue: string) => { if (ready.current || gameRef.current.phase === 'retrieving') commit(typeKey(gameRef.current, keyValue, performance.now(),Math.random,process.env.NODE_ENV === 'development' ? overrides.current : {},conditionsRef.current(saveRef.current),process.env.NODE_ENV==='development')); }, [commit]);
  const again = useCallback(() => { if (gameRef.current.phase === 'result' || gameRef.current.phase === 'retrieved') commit({ phase: 'idle' }); }, [commit]);
  const reelIn = useCallback(() => { if (gameRef.current.phase === 'retrieving') commit({ phase: 'retrieved' }); },[commit]);
  const biteNow = useCallback(() => { if (process.env.NODE_ENV === 'development') commit(triggerBite(gameRef.current, performance.now(), Math.random, overrides.current, conditionsRef.current(saveRef.current),true,true)); }, [commit]);
  const clearChecks=useCallback(()=>setChecks([]),[]);
  return { game, save, updateSave, castLine, key, again, reelIn, armChallenge, biteNow, overrides, storageError,checks,clearChecks };
}
