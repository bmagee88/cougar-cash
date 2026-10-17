import { CSSProperties } from 'react';
import { MoonPhase } from '../engine/types';
import { celestialPosition, lightingAt, moonlightAt } from '../engine/world';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
/** Cheap presentation values, evaluated by the existing environment clock. */
export function anglerShadowLight(hour: number, moonPhase: MoonPhase, visibility: number) {
  const night = lightingAt(hour, moonPhase).nightAmount;
  const sun = celestialPosition(hour), moon = celestialPosition(hour, true);
  const daylight = (1 - night) * Number(sun.visible) * clamp(visibility);
  const moonlight = moonlightAt(hour, moonPhase, visibility);
  // The close lantern is left of the angler, so its faint cast falls right.
  const source = daylight > .12 ? sun : moonlight > .48 ? moon : { x: 8, y: 70 };
  const lowLight = clamp((source.y - 8) / 65);
  return {
    contact: .64 - night * .15,
    cast: .21 * daylight + .055 * night + .045 * moonlight,
    shear: Math.max(-.65, Math.min(.65, (source.x - 24) / 76 * (.18 + lowLight * .48))),
    flatten: -(.12 + lowLight * .24),
    blur: 1.2 + lowLight * 1.5 + (1 - clamp(visibility)) * 1.8,
  };
}
export function anglerShadowStyle(hour: number, moonPhase: MoonPhase, visibility: number): CSSProperties {
  const shadow = anglerShadowLight(hour, moonPhase, visibility);
  return {
    '--angler-shadow-contact': shadow.contact, '--angler-shadow-cast': shadow.cast,
    '--angler-shadow-shear': shadow.shear, '--angler-shadow-flatten': shadow.flatten,
    '--angler-shadow-blur': `${shadow.blur}px`,
  } as CSSProperties;
}
