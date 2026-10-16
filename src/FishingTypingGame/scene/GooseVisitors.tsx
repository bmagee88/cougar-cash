import React, { CSSProperties, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { artwork } from '../engine/artwork';
import { goosePose, GooseVisit, gooseVisitAt, nextGooseChange, previewGooseVisit } from '../engine/geese';
import { Season, Weather } from '../engine/types';
import { gooseDirection } from '../engine/visitors';
import { LakeSoundControls } from '../audio/sounds';
import { ridgeHeight } from './solarLight';

type Frame = { width: number; height: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function gooseGeometry(visit: GooseVisit, frame: Frame, season: Season, location: string) {
  const { width, height } = frame;
  const unit = Math.min(Math.max(18, Math.min(36, width * .03)), height * .04);
  const aspect = location === 'cove' ? 1672 / 941 : 2;
  const imageWidth = Math.max(width * 1.02, height * 1.02 * aspect), imageHeight = imageWidth / aspect;
  const samples = Array.from({ length: 11 }, (_, i) => goosePose(visit, i / 10));
  const flight: Record<string, string | number> = { '--flock-width': `${unit * visit.width}px`, '--flock-height': `${unit * visit.height}px`, '--goose-unit': `${unit}px` };
  samples.forEach((pose, i) => { flight[`--gx${i}`] = `${pose.x}cqw`; flight[`--gy${i}`] = `${pose.y}cqh`; flight[`--gs${i}`] = pose.scale; });
  const birds = visit.birds.map(bird => {
    const style: Record<string, string | number> = { left: `${(bird.x / visit.width + .5) * 100}%`, top: `${(bird.y / visit.height + .5) * 100}%` };
    samples.forEach((pose, i) => {
      const x = pose.x / 100 * width + bird.x * unit * pose.scale * visit.direction;
      const y = pose.y / 100 * height + bird.y * unit * pose.scale;
      const sourceX = (x - (width - imageWidth) / 2) / imageWidth;
      const ridgeY = (height - imageHeight) / 2 + ridgeHeight(sourceX, season, location) * imageHeight;
      const sky = clamp((ridgeY - y + height * .008) / (height * .016));
      style[`--ge${i}`] = .76 - sky * .43;
    });
    return style as CSSProperties;
  });
  return { flight: flight as CSSProperties, birds };
}

function GooseFlight({ visit, frame, season, location, intervalMs, audio }: { visit: GooseVisit; frame: Frame; season: Season; location: string; intervalMs: number; audio?: LakeSoundControls }) {
  // Freeze the initial delay; recomputing it on clock renders would double speed.
  const [age] = useState(() => Math.max(0, Date.now() - visit.startAt));
  const geometry = useMemo(() => gooseGeometry(visit, frame, season, location), [visit, frame, season, location]);
  const far = Math.max(visit.startScale, visit.endScale) < .56;
  const base = `visitors/canada-goose/${far ? 'far/' : ''}`;
  useEffect(() => {
    if (!audio) return;
    let timer: ReturnType<typeof setTimeout>;
    const honk = () => {
      const now = Date.now(), progress = (now - visit.startAt) / visit.durationMs;
      if (progress >= 1 || document.hidden) return;
      const pose = goosePose(visit, progress);
      if (pose.x > -3 && pose.x < 103) audio.play('geese', { depth: pose.depth, pan: pose.x / 50 - 1, volume: .52 + visit.birds.length * .025 });
      timer = setTimeout(honk, 4200 + Math.random() * 3600);
    };
    timer = setTimeout(honk, 500 + Math.random() * 1200);
    return () => clearTimeout(timer);
  }, [visit, audio]);
  return <div className={`f-geese-pass ${visit.direction < 0 ? 'f-geese-west' : ''}`} data-layer="geese" data-visit-id={visit.id} data-direction={visit.direction > 0 ? 'left-to-right' : 'right-to-left'} data-formation={visit.shape} data-goose-count={visit.birds.length}
    data-start-scale={visit.startScale.toFixed(3)} data-end-scale={visit.endScale.toFixed(3)} data-duration-ms={visit.durationMs} data-resolution={far ? 32 : 64}
    aria-hidden="true" style={{ ...geometry.flight, '--goose-duration': `${visit.durationMs}ms`, '--goose-delay': `${-age}ms` } as CSSProperties}>
    <div className="f-geese-formation">{visit.birds.map((bird, index) => <span key={index} className="f-goose-flight" data-wing-phase={bird.phase} style={geometry.birds[index]}>
      {intervalMs ? <span className="f-goose-sampled" style={{ backgroundImage: `url("${artwork(`${base}flight-sheet.webp`)}")`, animationDelay: `-${bird.phase * .05}s` }} /> : <img src={artwork(`${base}flight-${bird.phase}.gif`)} alt="" decoding="async" draggable={false} />}
    </span>)}</div>
  </div>;
}

/** A sleeping schedule timer, with no animation loop and no visibility rerolls. */
export default function GooseVisitors({ sceneRef, season, weather, reducedMotion, preview = 0, intervalMs = 0, frame = { width: 1200, height: 700 }, location = 'dock', audio }: {
  sceneRef: RefObject<HTMLDivElement>; season: Season; weather: Weather; reducedMotion: boolean; preview?: number; intervalMs?: number; frame?: Frame; location?: string; audio?: LakeSoundControls;
}) {
  const [visit, setVisit] = useState<GooseVisit>();
  const refresh = useRef<(() => void) | undefined>(undefined), previewFlight = useRef<GooseVisit | undefined>(undefined);
  const active = useRef<GooseVisit | undefined>(undefined);
  const latest = useRef({ weather, preview }); latest.current = { weather, preview };
  const lastPreview = useRef(0), suppressed = useRef(new Set<string>());
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || reducedMotion || !gooseDirection(season)) { setVisit(undefined); return; }
    previewFlight.current = undefined; active.current = undefined; lastPreview.current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined, visible = true;
    const update = () => {
      clearTimeout(timer);
      if (document.hidden || !visible) { active.current = undefined; setVisit(undefined); return; }
      const now = Date.now();
      if (latest.current.preview && latest.current.preview !== lastPreview.current) {
        lastPreview.current = latest.current.preview; previewFlight.current = previewGooseVisit(now, season, latest.current.preview);
      }
      const preview = previewFlight.current;
      let next = preview && now < preview.endAt ? preview : gooseVisitAt(now, season);
      if (next && next !== preview && ['hurricane', 'blizzard', 'thunderstorm'].includes(latest.current.weather) && active.current?.id !== next.id) suppressed.current.add(next.id);
      while (suppressed.current.size > 4) suppressed.current.delete(suppressed.current.keys().next().value!);
      if (next && suppressed.current.has(next.id)) next = undefined;
      active.current = next;
      setVisit(previous => previous?.id === next?.id ? previous : next);
      const deadline = next?.endAt ?? nextGooseChange(now, season);
      timer = setTimeout(update, Math.max(50, deadline - now));
    };
    refresh.current = update;
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; update(); });
    observer?.observe(scene); document.addEventListener('visibilitychange', update); update();
    return () => { clearTimeout(timer); observer?.disconnect(); document.removeEventListener('visibilitychange', update); refresh.current = undefined; };
  }, [sceneRef, season, reducedMotion]);
  useEffect(() => { refresh.current?.(); }, [preview, weather]);
  if (reducedMotion || !gooseDirection(season) || !visit) return null;
  return <GooseFlight key={`${visit.id}-${visit.direction}`} visit={visit} frame={frame} season={season} location={location} intervalMs={intervalMs} audio={audio} />;
}
