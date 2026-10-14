import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CharacterState, Encounter, FishCheck, GameState, SceneAsset, Season, Weather, WorldConditions } from '../engine/types';
import { ANGLER_OUTFITS, ANGLER_RIG, BACKGROUND_PARALLAX, CEDAR_SCENE, COVE_GROUND_FRAME, DOCK_PARALLAX, FISHING_ART, sceneForLocation } from './manifest';
import { celestialPosition, moonlightAt, PERIOD_LABELS, SEASON_LABELS } from '../engine/world';
import CelestialSky from './CelestialSky';
import LakeBackdrop, { MountainHaze } from './LakeBackdrop';
import FishLanding from './FishLanding';
import { useSceneParallax } from './useSceneParallax';
import { useFishBattle } from './useFishBattle';
import CloudSystem from './CloudSystem';
import { WeatherVisuals, weatherLighting, weatherVisuals } from '../engine/weather';
import WeatherParticles from './WeatherParticles';
import { useWeatherLayers } from './useWeatherLayers';
import { useWeatherMotion } from './useWeatherMotion';
import FishCheckBeacon from './FishCheckBeacon';
import WaterGrassCover, { WaterCover } from './WaterGrassCover';
import { pointOnReelPath, reelPath } from './reelPath';

export function SceneLayer({ layer }: { layer: SceneAsset }) {
  const p = layer.position;
  const depth = layer.zIndex < 5 ? 'background' : 'foreground';
  const style: CSSProperties = { left: `${p.x}%`, top: `${p.y}%`, width: `${p.width}%`, height: `${p.height}%`, zIndex: layer.zIndex,
    opacity: layer.opacity, '--layer-scale': layer.scale, '--parallax': layer.parallax, '--flip-x': layer.flipX ? -1 : 1,
    ...(layer.id === 'dock' ? { width: `var(--dock-width, ${p.width}%)` } : {}),
    ...(layer.aspectRatio ? { height: 'auto', aspectRatio: layer.aspectRatio } : {}),
    ...(layer.minWidth ? { minWidth: layer.minWidth } : {}),
    ...(layer.fadeTop ? { maskImage: `linear-gradient(to bottom, transparent, black ${layer.fadeTop}%, black)`, WebkitMaskImage: `linear-gradient(to bottom, transparent, black ${layer.fadeTop}%, black)` } : {}) } as CSSProperties;
  if (layer.format === 'procedural') return layer.id === 'reflections' ? <div data-layer={layer.id} data-scene-depth={depth} style={style} className="f-scene-layer f-reflections" /> : null;
  if (layer.format === 'spritesheet' && layer.sprite) return <div data-scene-depth={depth} style={{ ...style, backgroundImage: `url(${layer.src})`, backgroundSize: `${layer.sprite.frames * 100}% 100%`, animation: `f-sprite ${layer.sprite.frames / layer.sprite.fps}s steps(${layer.sprite.frames}) infinite` }} className="f-scene-layer" />;
  const artwork = <img data-layer={layer.id} data-scene-depth={depth} src={layer.src} alt="" draggable={false} style={style} className={`f-scene-layer ${layer.animation ? `f-${layer.animation}` : ''} ${layer.weatherResponse ? 'f-weather-responsive' : ''}`} />;
  return layer.id === 'cove-landscape' ? <>{artwork}<MountainHaze style={{ ...style, maskImage: `url("${layer.src}")`, WebkitMaskImage: `url("${layer.src}")`, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} /></> : artwork;
}
export function characterState(game: GameState, preview?: CharacterState): CharacterState {
  if (preview) return preview;
  if (game.phase === 'casting') return 'casting';
  if (game.phase === 'waiting') return 'waiting';
  if (game.phase === 'retrieving') return game.retrieve.rhythm === 'dead-stick' || game.retrieve.nibble ? 'waiting' : 'reeling';
  if (game.phase === 'typing') return 'reeling';
  if (game.phase === 'landing') return 'success';
  if (game.phase === 'result') return game.outcome === 'caught' ? 'success' : 'escape';
  return 'idle';
}
export function CharacterAnimator({ state, tipRef, handRef, dockLayer, shoreLayer, caughtFish, landingOriginRef, reducedMotion = false, season = 'spring' }: { state: CharacterState; tipRef?: React.RefObject<HTMLElement>; handRef?: React.RefObject<HTMLElement>; dockLayer?: SceneAsset; shoreLayer?: SceneAsset; caughtFish?: Encounter; landingOriginRef?: React.RefObject<HTMLDivElement>; reducedMotion?: boolean; season?: Season }) {
  const rig = ANGLER_RIG;
  const dock = dockLayer?.position;
  const characterStyle = {
    '--character-parallax': shoreLayer ? 0 : dockLayer?.parallax ?? DOCK_PARALLAX,
    ...(dock ? {
      left: `calc(${dock.x}% + var(--dock-width, ${dock.width}%) * var(--dock-seat-x, ${rig.dockSeat.x}))`,
      top: `calc(${dock.y}% + ${dock.height}% * var(--dock-seat-y, ${rig.dockSeat.y}))`,
      width: `calc(var(--dock-width, ${dock.width}%) * ${rig.dockSeat.characterWidth})`,
      '--seat-x': `${rig.seat.x * 100}%`, '--seat-y': `${rig.seat.y * 100}%`,
    } : {}),
    ...(shoreLayer?.seat ? {
      left: `${shoreLayer.seat.x * 100}%`, top: `${shoreLayer.seat.y * 100}%`, width: `${shoreLayer.seat.characterWidth * 100}%`,
      '--seat-x': `${rig.seat.x * 100}%`, '--seat-y': `${rig.seat.y * 100}%`,
    } : {}),
  } as CSSProperties;
  const rodStyle: CSSProperties = { left: `${(rig.hand.x - rig.rod.width * rig.rod.grip.x) * 100}%`, top: `${(rig.hand.y - rig.rod.height * rig.rod.grip.y) * 100}%`,
    width: `${rig.rod.width * 100}%`, height: `${rig.rod.height * 100}%`, transformOrigin: `${rig.rod.grip.x * 100}% ${rig.rod.grip.y * 100}%` };
  return <div className={`f-character f-character-${state} ${dock || shoreLayer?.seat ? 'f-character-seated' : ''}`} data-character-state={state} style={characterStyle}>
    <img className="f-angler-body" data-asset="fisherman" data-outfit-season={season} src={ANGLER_OUTFITS[season]} alt="" />
    {caughtFish && landingOriginRef && <FishLanding key={caughtFish.id} encounter={caughtFish} originRef={landingOriginRef} reducedMotion={reducedMotion} />}
    <i ref={handRef} className="f-angler-hand" style={{ left: `${rig.hand.x * 100}%`, top: `${rig.hand.y * 100}%` }} />
    <div className="f-rod" style={rodStyle}><img data-asset="rod" src={FISHING_ART.rod} alt="" /><i ref={tipRef} className="f-rod-tip" style={{ left: `${rig.rod.tip.x * 100}%`, top: `${rig.rod.tip.y * 100}%` }} /></div>
  </div>;
}
export function FishingLine({ game, tipRef, handRef, landingOriginRef, progress, struggling, splashBurst, reducedMotion, checkPreview }: { game: GameState; tipRef?: React.RefObject<HTMLElement>; handRef?: React.RefObject<HTMLElement>; landingOriginRef?: React.RefObject<HTMLDivElement>; progress: number; struggling: boolean; splashBurst: number; reducedMotion: boolean; checkPreview?: FishCheck }) {
  const active = ['casting', 'waiting', 'retrieving', 'typing', 'landing'].includes(game.phase);
  const escaped = game.phase === 'result' && game.outcome === 'escaped';
  const [escapeDone, setEscapeDone] = useState(false);
  const escaping = escaped && !reducedMotion && !escapeDone;
  const showingLine = active || escaping;
  const line = useRef<SVGPathElement>(null); const svg = useRef<SVGSVGElement>(null); const bobber = useRef<HTMLDivElement>(null); const floatGroup = useRef<HTMLDivElement>(null);
  const coverLayer = useRef<HTMLDivElement>(null);
  const rememberedCover = useRef<WaterCover | undefined>(undefined);
  const retrieve = game.phase === 'retrieving' ? game.retrieve : undefined;
  const currentCover = useMemo<WaterCover | undefined>(() => retrieve ? { cover: retrieve.cover, phraseLength: retrieve.typing.phrase.length } : undefined, [retrieve]);
  useEffect(() => { if (currentCover) rememberedCover.current = currentCover; }, [currentCover]);
  const cover = currentCover ?? ((game.phase === 'typing' || game.phase === 'landing') && game.encounter.retrieve ? rememberedCover.current : undefined);
  const attachBobber = useCallback((element: HTMLDivElement | null) => {
    bobber.current = element;
    if (landingOriginRef) landingOriginRef.current = element;
  }, [landingOriginRef]);
  const distance = game.phase === 'casting' || game.phase === 'waiting' || game.phase === 'retrieving' ? game.castDistance ?? 1 : game.phase === 'typing' || game.phase === 'landing' ? game.encounter.castDistance ?? 1 : 1;
  const battle = useRef({ progress, struggling, distance });
  battle.current = { progress, struggling, distance };
  useEffect(() => {
    if (!escaped) { setEscapeDone(false); return; }
    // Also clean up when browser animations are paused in a background tab.
    const timer = setTimeout(() => setEscapeDone(true), 1400);
    return () => clearTimeout(timer);
  }, [escaped]);
  useEffect(() => {
    if (!showingLine || !tipRef) return;
    let frame: number; let last = -100;
    const position = (now: number) => {
      if (now - last > 40 && tipRef.current && svg.current && line.current) {
        const scene = svg.current.getBoundingClientRect(); const tip = tipRef.current.getBoundingClientRect();
        if (scene.width && scene.height) {
          // Interpolate toward water in front of the measured angler, including
          // responsive dock placement and parallax. All float effects move together.
          const hand = handRef?.current?.getBoundingClientRect();
          const nearX = hand ? Math.max(0.1, Math.min(0.56, (hand.left - scene.left) / scene.width + 0.065)) : 0.39;
          const nearY = hand ? Math.max(0.74, Math.min(0.91, (hand.top - scene.top) / scene.height + 0.12)) : 0.88;
          const path = reelPath(battle.current.distance, { x: nearX, y: nearY });
          if (coverLayer.current) {
            coverLayer.current.style.setProperty('--cover-far-x', `${path.far.x * 100}%`);
            coverLayer.current.style.setProperty('--cover-far-y', `${path.far.y * 100}%`);
            coverLayer.current.style.setProperty('--cover-near-x', `${path.near.x * 100}%`);
            coverLayer.current.style.setProperty('--cover-near-y', `${path.near.y * 100}%`);
          }
          if (floatGroup.current && !escaped) {
            const floatPoint = pointOnReelPath(path, battle.current.progress);
            floatGroup.current.style.left = `${floatPoint.x * 100}%`;
            floatGroup.current.style.top = `${floatPoint.y * 100}%`;
            // Keep the splash on the lake while the bobber alone flies toward the rod.
            const origin = floatGroup.current.getBoundingClientRect();
            const flightX = tip.left - origin.left - origin.width / 2;
            const flightY = tip.top + scene.height * 0.10 - origin.top;
            floatGroup.current.style.setProperty('--escape-x', `${flightX}px`);
            floatGroup.current.style.setProperty('--escape-y', `${flightY}px`);
            floatGroup.current.style.setProperty('--escape-peak', `${Math.min(flightY, -scene.height * 0.20) - scene.height * 0.12}px`);
          }
          const x = (tip.left - scene.left) / scene.width * 1200; const y = (tip.top - scene.top) / scene.height * 700;
          const float = bobber.current?.getBoundingClientRect();
          const endX = float ? (float.left + float.width / 2 - scene.left) / scene.width * 1200 : 719;
          const endY = float ? (float.top + float.height * 0.2 - scene.top) / scene.height * 700 : 473;
          const sag = escaped ? 35 : battle.current.struggling ? reducedMotion ? 0 : Math.sin(now / 30) * 3 : 15;
          line.current.setAttribute('d', `M${x.toFixed(1)} ${y.toFixed(1)}Q${((x + endX) / 2).toFixed(1)} ${(y + endY) / 2 + sag} ${endX.toFixed(1)} ${endY.toFixed(1)}`);
        }
        last = now;
      }
      frame = requestAnimationFrame(position);
    };
    frame = requestAnimationFrame(position); return () => cancelAnimationFrame(frame);
  }, [showingLine, escaped, tipRef, handRef, reducedMotion]);
  return <div className={`f-water-action f-water-${game.phase} ${game.phase === 'retrieving' && game.retrieve.nibble ? 'f-water-nibble' : ''} ${escaped ? 'f-water-escaped' : ''} ${struggling ? 'f-water-danger' : ''}`} data-cast-distance={distance} data-reel-progress={progress.toFixed(4)} data-line-tension={struggling ? 'danger' : 'normal'} style={{ '--water-parallax': BACKGROUND_PARALLAX } as CSSProperties}>
    <svg ref={svg} className="f-fishing-line" viewBox="0 0 1200 700" preserveAspectRatio="none">
      {showingLine && <path ref={line} d="M514 310Q560 400 719 473" fill="none" stroke="#f4f0d6" strokeWidth="1.3" opacity={escaped ? 0.65 : 0.85} />}
    </svg>
    {cover && <WaterGrassCover cover={cover} cursor={game.phase === 'retrieving' ? game.retrieve.maxReeled : undefined} layerRef={coverLayer} />}
    {showingLine && <div ref={floatGroup} className="f-float-group">
      <FishCheckBeacon check={checkPreview} />
      <div ref={attachBobber} className="f-bobber" onAnimationEnd={event => { if (escaped && event.target === event.currentTarget) setEscapeDone(true); }}><img data-asset="bobber" src={FISHING_ART.bobber} alt="" /></div><div className="f-bobber-ripple" /><div className="f-bobber-ripple f-ripple-second" />
      {(game.phase === 'casting' || game.phase === 'typing' || game.phase === 'landing') && <div className="f-splash">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}
      {struggling && <div className="f-splash f-error-splash" key={splashBurst} data-testid="fishing-error-splash">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i, '--splash-rise': `${28 + i % 5 * 8}px` } as CSSProperties} />)}</div>}
      {escaping && <div className="f-splash f-escape-splash" data-testid="fishing-escape-splash">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i, '--splash-rise': `${40 + i % 5 * 10}px` } as CSSProperties} />)}</div>}
    </div>}
  </div>;
}
export function WeatherSystem({ weather, visuals = weatherVisuals(weather), location = 'dock', reducedMotion = false }: { weather: Weather; visuals?: WeatherVisuals; location?: string; reducedMotion?: boolean }) {
  const heavy = weather === 'thunderstorm' || weather === 'hurricane';
  const layers = useWeatherLayers(weather, visuals, reducedMotion);
  return <>{layers.map(layer => <WeatherParticles key={layer.weather} {...layer} location={location} reducedMotion={reducedMotion} />)}
    <div className="f-weather f-weather-fog" data-layer="lake-fog" aria-hidden="true" style={{ opacity: weather === 'fog' ? 1 : 0 }}><div className="f-fog-bank" /></div>
    <div className="f-weather f-weather-fog f-storm-fog" data-layer="storm-fog" aria-hidden="true" style={{ opacity: ['thunderstorm','hurricane','blizzard'].includes(weather) ? visuals.fog : 0 }}><div className="f-fog-bank" /><div className="f-fog-wisp" /></div>
    <div className="f-rain-mist" data-layer="rain-mist" aria-hidden="true" style={{ opacity: heavy ? visuals.rain * (weather === 'hurricane' ? .28 : .18) : 0 }} />
    <div className="f-heat-haze" data-layer="heat-haze" aria-hidden="true" style={{ opacity: visuals.heat }} />
  </>;
}
export default function FishingScene({ game, location, weather, reducedMotion, world, preview, manifest = CEDAR_SCENE, weatherState, lightningPreview, checkPreview }: {
  game: GameState; location: string; weather: Weather; reducedMotion: boolean; world: WorldConditions; preview?: CharacterState; manifest?: SceneAsset[]; weatherState?: WeatherVisuals; lightningPreview?: number; checkPreview?: FishCheck;
}) {
  const tipRef = useRef<HTMLElement>(null); const handRef = useRef<HTMLElement>(null); const sceneRef = useRef<HTMLDivElement>(null);
  const landingOriginRef = useRef<HTMLDivElement>(null);
  const caughtFish = game.phase === 'landing' || (game.phase === 'result' && game.outcome === 'caught') ? game.encounter : undefined;
  const battle = useFishBattle(game);
  useSceneParallax(sceneRef, reducedMotion);
  const [animation, setAnimation] = useState<CharacterState>('idle');
  const lastPhase = useRef(game.phase);
  const phase = game.phase; const mappedAnimation = characterState(game);
  const seasonalManifest = sceneForLocation(world.season, location, manifest);
  const weatherLook = weatherState || weatherVisuals(weather);
  useWeatherMotion(sceneRef, weatherLook.wind, reducedMotion);
  const light = weatherLighting(world.hour, world.moonPhase, weather, weatherLook);
  const moonlight = moonlightAt(world.hour, world.moonPhase, weatherLook.celestial);
  const moon = celestialPosition(world.hour, true);
  const dockLayer = manifest.find(layer => layer.id === 'dock' && (!layer.spots || layer.spots.includes(location)));
  const shoreLayer = seasonalManifest.find(layer => layer.id === 'cove-seat');
  const hasAngler = seasonalManifest.some(layer => layer.id === 'angler');
  const sky = seasonalManifest.find(layer => ['sky', 'lake-background'].includes(layer.id));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (phase === 'casting') { setAnimation('preparing'); timer = setTimeout(() => setAnimation('casting'), 120); }
    else if (phase === 'typing') { setAnimation('bite'); timer = setTimeout(() => setAnimation('reeling'), 160); }
    else if (phase === 'idle' && lastPhase.current === 'result') { setAnimation('returning'); timer = setTimeout(() => setAnimation('idle'), 400); }
    else setAnimation(mappedAnimation);
    lastPhase.current = phase;
    return () => clearTimeout(timer);
  }, [phase, mappedAnimation]);
  return <div ref={sceneRef} className={`f-scene f-spot-${location} f-climate-${weather} f-season-${world.season} f-period-${world.period} ${light.brightness < .8 ? 'f-dim-light' : ''} ${battle.struggling ? 'f-battle-danger' : ''} ${reducedMotion ? 'f-reduced-motion' : ''}`} style={{ '--time-brightness': light.brightness, '--time-saturation': light.saturation, '--time-tint': light.tint, '--night-amount': light.nightAmount, '--weather-brightness': weatherLook.brightness, '--weather-saturation': weatherLook.saturation, '--celestial-opacity': weatherLook.celestial, '--mountain-haze-opacity': Math.max(weatherLook.greyDeck, weatherLook.darkDeck, weatherLook.tower * .25) } as CSSProperties} data-season={world.season} data-period={world.period} role="img" aria-label={`Animated freshwater lake at ${location === 'cove' ? 'Willow cove' : 'the old dock'}, ${SEASON_LABELS[world.season]}, ${PERIOD_LABELS[world.period]}, ${weather} weather`}>
    <div className="f-scene-base" aria-hidden="true" /><CelestialSky world={world} background={sky?.src || ''} /><div className="f-sky-grain" />
    {seasonalManifest.filter(l => !l.spots || l.spots.includes(location)).map(layer => {
      if (layer.id === 'weather') return <WeatherSystem key={layer.id} weather={weather} visuals={weatherLook} location={location} reducedMotion={reducedMotion} />;
      if (layer.id === 'clouds') return <CloudSystem key={layer.id} visuals={weatherLook} reducedMotion={reducedMotion} lightningPreview={lightningPreview} />;
      if (layer.id === 'angler') return shoreLayer ? null : <CharacterAnimator key={layer.id} season={world.season} state={preview || animation} tipRef={tipRef} handRef={handRef} dockLayer={dockLayer} caughtFish={caughtFish} landingOriginRef={landingOriginRef} reducedMotion={reducedMotion} />;
      if (layer.id === 'cove-seat') return <div key={layer.id} className="f-cove-ground-plane" style={{
        '--cove-min-width': `${COVE_GROUND_FRAME.minWidth}px`, '--cove-cover-width': `${COVE_GROUND_FRAME.aspectRatio * 100}cqh`, '--cove-seat-screen-x': `${COVE_GROUND_FRAME.screenSeatX * 100}%`,
        '--cove-seat-x': layer.seat?.x ?? .29, '--ground-parallax': layer.parallax, aspectRatio: COVE_GROUND_FRAME.aspectRatio,
      } as CSSProperties}>
        <SceneLayer layer={{ ...layer, parallax: 0 }} />
        {hasAngler && <CharacterAnimator season={world.season} state={preview || animation} tipRef={tipRef} handRef={handRef} shoreLayer={layer} caughtFish={caughtFish} landingOriginRef={landingOriginRef} reducedMotion={reducedMotion} />}
      </div>;
      if (layer.id === 'water-interactions') return <FishingLine key={layer.id} checkPreview={checkPreview} game={game} tipRef={tipRef} handRef={handRef} landingOriginRef={landingOriginRef} reducedMotion={reducedMotion} {...battle} />;
      if (layer.id === 'lake-background') return <LakeBackdrop key={layer.id} layer={layer} season={world.season} />;
      return <SceneLayer key={layer.id} layer={layer} />;
    })}
    <div className="f-time-tint" />
    <div className="f-moonlight" data-testid="fishing-moonlight" data-moonlight-intensity={moonlight.toFixed(4)} aria-hidden="true" style={{ opacity: moonlight * .24, '--moonlight-x': `${moon.x}%`, '--moonlight-y': `${moon.y}%` } as CSSProperties} />
    <svg className="f-birds" viewBox="0 0 100 25"><path d="m10 14q5-7 10 0 5-7 10 0m28-6q4-5 8 0 4-5 8 0" fill="none" stroke="#355e54" strokeWidth="1.5" /></svg>
  </div>;
}

