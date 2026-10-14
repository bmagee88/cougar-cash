import { BALANCE } from './config';
import { Performance, TypingState } from './types';

export function createTyping(phrase: string, now: number): TypingState { return { phrase, typed: '', startedAt: now, deadline: now + BALANCE.challengeMs, attempts: 0, errors: 0 }; }
export function applyKey(state: TypingState, key: string, now: number): TypingState {
  if (state.finishedAt !== undefined || now >= state.deadline) return state;
  if (key === 'Backspace') return { ...state, typed: state.typed.slice(0, -1) };
  if (key.length !== 1 || !/^[\x20-\x7e]$/.test(key) || state.typed.length >= state.phrase.length) return state;
  const blocked = state.typed !== state.phrase.slice(0, state.typed.length);
  const wrong = blocked || key !== state.phrase[state.typed.length];
  const typed = blocked ? state.typed : state.typed + key;
  return { ...state, typed, attempts: state.attempts + 1, errors: state.errors + Number(wrong), finishedAt: typed === state.phrase ? now : undefined };
}
export function typingPerformance(state: TypingState, now: number): Performance {
  const end = Math.min(state.finishedAt ?? now, state.deadline);
  let correctCharacters = 0;
  while (correctCharacters < state.typed.length && state.typed[correctCharacters] === state.phrase[correctCharacters]) correctCharacters++;
  return { correctCharacters, wpm: +(correctCharacters / 5 / (Math.max(250, end - state.startedAt) / 60000)).toFixed(1),
    accuracy: state.attempts ? Math.round((state.attempts - state.errors) / state.attempts * 100) : 0,
    timeRemaining: +((state.deadline - end) / 1000).toFixed(2) };
}
