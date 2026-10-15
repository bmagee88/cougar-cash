import { GameState } from './types';
import { RETRIEVE_WINDOW_MS } from './interactive';

/** Earliest rule boundary. Key presses still run the engine immediately. */
export function nextWake(state: GameState, now: number, ready: boolean): number | undefined {
  switch (state.phase) {
    case 'casting': return state.waitAt;
    case 'waiting': return state.biteAt;
    case 'typing': return ready ? state.typing.deadline : undefined;
    case 'landing': return state.resultAt;
    case 'retrieving': {
      const r = state.retrieve;
      const times = [r.lastKeyAt + 1000, r.lastKeyAt + RETRIEVE_WINDOW_MS, ...r.keys.map(at => at + RETRIEVE_WINDOW_MS)].filter(at => at > now);
      times.push(r.nibble ? r.nibble.resolvesAt : Math.max(r.lastKeyAt + RETRIEVE_WINDOW_MS, r.lastRollAt + RETRIEVE_WINDOW_MS));
      return Math.min(...times);
    }
    default: return undefined;
  }
}
