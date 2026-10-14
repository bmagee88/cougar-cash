import { BALANCE, LOCATIONS, SPECIES } from './config';
import { CatchRecord, CatchTypingMemory, DAY_PERIODS, Encounter, FishingConditions, MOON_PHASES, Performance, QUALITIES, RARITIES, RetrieveMemory, SaveData, SEASONS, WEATHERS } from './types';
import { DEFAULT_TACKLE, normalizeTackle, RETRIEVES } from './tackle';
import { readNaturalWeather } from './naturalWeather';
import { HAIKU_BY_TEXT, HAIKU_SOURCE } from './haiku';
export const SAVE_KEY = 'cougar-fishing-v1';
function readRetrieve(value: unknown): RetrieveMemory | undefined {
  const memory=value as Partial<RetrieveMemory> | undefined;
  return memory && typeof memory.phrase==='string' && HAIKU_BY_TEXT.has(memory.phrase) && typeof memory.reeled==='number' && Number.isFinite(memory.reeled) && memory.reeled>=0 && memory.reeled<=1
    && ['steady','jerky','dead-stick'].includes(memory.rhythm!) && typeof memory.grass==='boolean' ? {phrase:memory.phrase,reeled:memory.reeled,rhythm:memory.rhythm!,grass:memory.grass} : undefined;
}
function readTypingMemory(value: unknown): CatchTypingMemory | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const memory = value as Partial<CatchTypingMemory>;
  if (typeof memory.phrase !== 'string' || memory.phrase.length > 512 || !/^[a-z]+(?: [a-z]+)*$/.test(memory.phrase)) return undefined;
  const poem = memory.haiku;
  const shortText = (text: unknown): text is string => typeof text === 'string' && text.trim().length > 0 && text.length <= 200;
  const validPoem = poem && shortText(poem.id) && shortText(poem.author) && shortText(poem.translator)
    && Array.isArray(poem.lines) && poem.lines.length > 0 && poem.lines.length <= 5 && poem.lines.every(shortText);
  return { phrase: memory.phrase, ...(validPoem ? { haiku: { id: poem.id, author: poem.author, translator: poem.translator, lines: [...poem.lines] } } : {}) };
}
export function emptySave(): SaveData {
  return { version: 1, livewell: [], balance: BALANCE.initialBalance, location: 'dock', awardedIds: [],
    tackle: { ...DEFAULT_TACKLE },
    settings: { weather: 'sunny', sound: false, reducedMotion: false, fishingMode: 'standard' },
    stats: { caught: 0, escaped: 0, discovered: [], byRarity: Object.fromEntries(RARITIES.map(r => [r, 0])) as SaveData['stats']['byRarity'],
      byQuality: Object.fromEntries(QUALITIES.map(q => [q, 0])) as SaveData['stats']['byQuality'], albinos: 0, albinoDiscovered: [], largest: {}, bestWpm: 0, totalWpm: 0, currentStreak: 0, longestStreak: 0 } };
}
export function deserializeSave(raw: string | null): SaveData {
  const fallback = emptySave();
  try {
    const data = JSON.parse(raw || 'null');
    if (!data || data.version !== 1 || !Array.isArray(data.livewell) || !data.stats || !Array.isArray(data.stats.discovered) || !Array.isArray(data.awardedIds)) return fallback;
    const number = (n: unknown, base = 0) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : base;
    const stats = { ...fallback.stats, ...data.stats };
    (['caught', 'escaped', 'albinos', 'bestWpm', 'totalWpm', 'currentStreak', 'longestStreak'] as const).forEach(k => { stats[k] = number(data.stats[k]); });
    stats.byRarity = Object.fromEntries(RARITIES.map(r => [r, number(data.stats.byRarity?.[r])])) as typeof stats.byRarity;
    stats.byQuality = Object.fromEntries(QUALITIES.map(q => [q, number(data.stats.byQuality?.[q])])) as typeof stats.byQuality;
    stats.discovered = data.stats.discovered.filter((id: string) => SPECIES.some(s => s.id === id));
    stats.albinoDiscovered = Array.isArray(data.stats.albinoDiscovered) ? data.stats.albinoDiscovered.filter((id: string) => SPECIES.some(s => s.id === id)) : [];
    stats.largest = Object.fromEntries(Object.entries(data.stats.largest || {}).filter(([id, size]: [string, any]) => SPECIES.some(s => s.id === id) && number(size?.lengthCm) > 0 && number(size?.weightKg) > 0));
    const naturalWeather=data.settings?.weatherMode === 'natural' ? readNaturalWeather(data.settings.naturalWeather) : undefined;
    return { ...fallback, stats, tackle: normalizeTackle(data.tackle), balance: number(data.balance, BALANCE.initialBalance), location: LOCATIONS.some(l => l.id === data.location) ? data.location : 'dock',
      awardedIds: data.awardedIds.filter((id: unknown) => typeof id === 'string'),
      livewell: data.livewell.filter((c: CatchRecord) => c && typeof c.id === 'string' && SPECIES.some(s => s.id === c.speciesId) && RARITIES.includes(c.rarity) && QUALITIES.includes(c.quality) && typeof c.isAlbino === 'boolean' && number(c.lengthCm) > 0 && number(c.weightKg) > 0 && Number.isFinite(c.wpm) && Number.isFinite(c.accuracy) && typeof c.caughtAt === 'string').slice(-BALANCE.livewellCapacity).map((c: CatchRecord) => {
        const { typing: savedTyping, conditions: savedConditions, retrieve: savedRetrieve, ...record } = c; const typing = readTypingMemory(savedTyping); const retrieve=readRetrieve(savedRetrieve);
        const valid = savedConditions && SEASONS.includes(savedConditions.season) && DAY_PERIODS.includes(savedConditions.period) && MOON_PHASES.includes(savedConditions.moonPhase);
        const conditions: FishingConditions | undefined = valid ? { season: savedConditions.season, period: savedConditions.period, moonPhase: savedConditions.moonPhase,
          ...(WEATHERS.includes(savedConditions.weather!) ? { weather: savedConditions.weather } : {}),
          ...(Number.isFinite(savedConditions.stormAgeMs) && savedConditions.stormAgeMs! >= 0 ? { stormAgeMs: savedConditions.stormAgeMs } : {}),
          ...(Number.isFinite(savedConditions.weatherDurationMs) && savedConditions.weatherDurationMs! > 0 ? { weatherDurationMs: savedConditions.weatherDurationMs } : {}),
          ...(savedConditions.observedRetrieve && Object.hasOwnProperty.call(RETRIEVES,savedConditions.observedRetrieve) ? { observedRetrieve: savedConditions.observedRetrieve } : {}),
          ...(savedConditions.tackle ? { tackle: normalizeTackle(savedConditions.tackle) } : {}) } : undefined;
        return { ...record, ...(typing ? { typing } : {}), ...(retrieve ? { retrieve } : {}), ...(conditions ? { conditions } : {}) };
      }),
      settings: { sound: data.settings?.sound === true, reducedMotion: data.settings?.reducedMotion === true, fishingMode: data.settings?.fishingMode==='interactive' ? 'interactive' : 'standard', weather: naturalWeather?.weather ?? (WEATHERS.includes(data.settings?.weather) ? data.settings.weather : 'sunny'),
        ...(data.settings?.weatherMode === 'natural' ? { weatherMode: 'natural' as const, ...(naturalWeather ? { naturalWeather } : {}) } : {}),
        ...(data.settings?.weatherMode !== 'natural' && data.settings?.weather === 'thunderstorm' && number(data.settings?.stormStartedAt) > 0 ? { stormStartedAt: data.settings.stormStartedAt } : {}) } };
  } catch { return fallback; }
}
export function readSave(): SaveData { try { return deserializeSave(localStorage.getItem(SAVE_KEY)); } catch { return emptySave(); } }
export function persistSave(save: SaveData): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; } }
export function awardCatch(save: SaveData, encounter: Encounter, performance: Performance, caughtAt = new Date().toISOString()): SaveData {
  if (save.awardedIds.includes(encounter.id)) return save;
  const poem = HAIKU_BY_TEXT.get(encounter.phrase);
  const typing: CatchTypingMemory = { phrase: encounter.phrase, ...(poem ? { haiku: { id: poem.id, author: poem.author, translator: HAIKU_SOURCE.translator, lines: [...poem.lines] } } : {}) };
  const catchRecord: CatchRecord = { id: encounter.id, speciesId: encounter.species.id, rarity: encounter.species.rarity, quality: encounter.quality, isAlbino: encounter.isAlbino, lengthCm: encounter.lengthCm, weightKg: encounter.weightKg, caughtAt, location: save.location, typing, ...(encounter.retrieve ? { retrieve: encounter.retrieve } : {}), ...(encounter.conditions ? { conditions: encounter.conditions } : {}), ...performance };
  const s = save.stats; const streak = s.currentStreak + 1; const previous = s.largest[encounter.species.id];
  return { ...save, balance: save.balance + BALANCE.catchCoins, livewell: [...save.livewell, catchRecord], awardedIds: [...save.awardedIds, encounter.id],
    stats: { ...s, caught: s.caught + 1, discovered: Array.from(new Set([...s.discovered, encounter.species.id])),
      byRarity: { ...s.byRarity, [encounter.species.rarity]: s.byRarity[encounter.species.rarity] + 1 }, byQuality: { ...s.byQuality, [encounter.quality]: s.byQuality[encounter.quality] + 1 },
      albinos: s.albinos + Number(encounter.isAlbino), albinoDiscovered: encounter.isAlbino ? Array.from(new Set([...s.albinoDiscovered, encounter.species.id])) : s.albinoDiscovered, largest: { ...s.largest, [encounter.species.id]: { lengthCm: Math.max(previous?.lengthCm || 0, encounter.lengthCm), weightKg: Math.max(previous?.weightKg || 0, encounter.weightKg) } },
      bestWpm: Math.max(s.bestWpm, performance.wpm), totalWpm: s.totalWpm + performance.wpm, currentStreak: streak, longestStreak: Math.max(s.longestStreak, streak) } };
}
export function awardEscape(save: SaveData, performance?: Performance): SaveData {
  return { ...save, stats: { ...save.stats, escaped: save.stats.escaped + 1, currentStreak: 0,
    bestWpm: Math.max(save.stats.bestWpm, performance?.wpm || 0), totalWpm: save.stats.totalWpm + (performance?.wpm || 0) } };
}
export function releaseFishes(save: SaveData, ids: readonly string[]): SaveData {
  const released = new Set(ids); const livewell = save.livewell.filter(c => !released.has(c.id));
  return livewell.length === save.livewell.length ? save : { ...save, livewell };
}
export function releaseFish(save: SaveData, id: string): SaveData { return releaseFishes(save, [id]); }
export function travel(save: SaveData, id: string): SaveData {
  const destination = LOCATIONS.find(l => l.id === id);
  return !destination || id === save.location || save.balance < destination.cost ? save : { ...save, location: id, balance: save.balance - destination.cost };
}
