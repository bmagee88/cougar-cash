export const WATER_SOUNDS = {
  cast: { label: 'Lure landing', gain: .8, cooldown: 350 },
  nibble: { label: 'Gentle nibble', gain: .42, cooldown: 550 },
  bite: { label: 'Fish bite', gain: .85, cooldown: 400 },
  thrash: { label: 'Fish struggling', gain: .85, cooldown: 650 },
  escape: { label: 'Fish escaping', gain: .9, cooldown: 500 },
  landing: { label: 'Lifting a catch', gain: .7, cooldown: 500 },
  release: { label: 'Releasing a fish', gain: .8, cooldown: 300 },
  lure: { label: 'Lure moving through water', gain: .35, cooldown: 420 },
  lake: { label: 'Fish jumping on the lake', gain: .7, cooldown: 400 },
  geese: { label: 'Canada goose calls', gain: .6, cooldown: 1800 },
} as const;
export type WaterSound = keyof typeof WATER_SOUNDS;
export type WaterSoundOptions = { depth?: number; pan?: number; weightKg?: number; volume?: number };
export type PlayWaterSound = (kind: WaterSound, options?: WaterSoundOptions) => void;
export interface LakeSoundControls {
  play: PlayWaterSound;
  unlock: () => void;
  preview: (kind: WaterSound) => Promise<boolean>;
  rain: (level: number) => void;
  visible: (visible: boolean) => void;
}
export const readSoundVolume = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .55;
export const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

/** About +/- half a semitone; weight changes body, not the nature of the sound. */
export function soundVariation(random: () => number, lastVariant?: number, weightKg = 0) {
  const variant = lastVariant === undefined ? Math.min(2, Math.floor(random() * 3)) : (lastVariant + 1 + Math.min(1, Math.floor(random() * 2))) % 3;
  const pitch = 2 ** ((random() - .5) * 1.1 / 12) * (1 - Math.min(.14, Math.max(0, weightKg) * .006));
  return { variant, pitch };
}
