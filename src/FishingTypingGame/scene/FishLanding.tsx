import React, { CSSProperties, RefObject, useLayoutEffect, useRef } from 'react';
import { BALANCE } from '../engine/config';
import { Encounter } from '../engine/types';
import { ANGLER_RIG } from './manifest';
import { fishDisplaySize } from '../engine/specimens';

/** The destination lives on the angler; only the flight starts at the water. */
export default function FishLanding({ encounter, originRef, reducedMotion }: {
  encounter: Encounter; originRef: RefObject<HTMLDivElement>; reducedMotion: boolean;
}) {
  const destinationRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const destination = destinationRef.current;
    const origin = originRef.current;
    if (!destination || !origin || reducedMotion) return;
    const lap = destination.getBoundingClientRect();
    const water = origin.getBoundingClientRect();
    const angler = destination.parentElement?.getBoundingClientRect();
    const x = water.left + water.width / 2 - (lap.left + lap.width / 2);
    const y = water.top + water.height * 0.75 - (lap.top + lap.height / 2);
    destination.style.setProperty('--land-from-x', `${x}px`);
    destination.style.setProperty('--land-from-y', `${y}px`);
    destination.style.setProperty('--land-peak-y', `${Math.min(0, y) - (angler?.height ?? 150) * 0.23}px`);
  }, [encounter.id, originRef, reducedMotion]);
  const lap = ANGLER_RIG.lap;
  const size=fishDisplaySize(encounter.species,encounter.lengthCm,encounter.weightKg);
  return <div ref={destinationRef} className="f-landed-fish" data-testid="fishing-lap-catch" style={{
    left: `${lap.x * 100}%`, top: `${lap.y * 100}%`, width: `${lap.fishWidth * size.width / .8 * 100}%`,
    '--land-duration': `${BALANCE.landingMs * 0.85}ms`,
  } as CSSProperties}>
    <img className="f-fish-jump" style={{scale:`1 ${size.thickness}`}} src={encounter.isAlbino ? encounter.species.albinoArtwork : encounter.species.artwork} alt="" />
  </div>;
}
