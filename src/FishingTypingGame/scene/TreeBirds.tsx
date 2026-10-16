import React, { CSSProperties, memo, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { artwork } from '../engine/artwork';
import { previewTreeBirdVisit, TreeBirdVisit, treeBirdPose, treeBirdSchedule } from '../engine/treeBirds';
import { lakeFrame } from './lakeFrame';
import { birdPlane, treesForLocation } from './treeMap';

const SAMPLES = 60;
function BirdFlight({ visit }: { visit: TreeBirdVisit }) {
  // Preserve the starting delay across world-clock renders and stepped updates.
  const [age] = useState(() => Math.max(0, Date.now() - visit.startAt));
  const styles = useMemo(() => visit.birds.map(route => {
    const style: Record<string, string | number> = {
      '--bird-duration': `${route.durationMs}ms`, '--bird-delay': `${route.delayMs - age}ms`,
      '--bird-bound-period': `${route.durationMs / route.bounds}ms`, '--bird-wing-phase': `${-route.phase * route.durationMs / route.bounds}ms`,
      '--bird-face': route.to.x > route.from.x ? 1 : -1,
    };
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES, pose = treeBirdPose(route, t);
      const before = treeBirdPose(route, Math.max(0, t - .002)), after = treeBirdPose(route, Math.min(1, t + .002));
      const direction = route.to.x > route.from.x ? 1 : -1;
      const angle = Math.max(-28, Math.min(28, Math.atan2(after.y - before.y, Math.abs(after.x - before.x) || .00001) * 180 / Math.PI * direction));
      style[`--bx${i}`] = pose.x; style[`--by${i}`] = pose.y; style[`--bs${i}`] = pose.scale;
      style[`--bo${i}`] = pose.opacity; style[`--ba${i}`] = `${angle}deg`;
    }
    return style as CSSProperties;
  }), [visit, age]);
  return <div data-bird-visit={visit.id} data-bird-stream={visit.stream} data-bird-count={visit.birds.length}>
    {visit.birds.map((route, index) => <span key={index} className="f-tree-bird" data-from-tree={route.fromTree} data-to-tree={route.toTree ?? 'offscreen'} data-start-z={route.from.z} data-end-z={route.to.z} style={styles[index]}>
      <i className="f-tree-bird-wing" />
    </span>)}
  </div>;
}

export function TreeMapOverlay({ location }: { location: string }) {
  return <div className="f-tree-map" data-layer="tree-map" aria-hidden="true"><div style={lakeFrame(location)}>
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">{treesForLocation(location).map((tree, index) => {
      const x = tree.top.x * 1000, top = tree.top.y * 1000, bottom = tree.bottom.y * 1000;
      return <g key={tree.id} data-mapped-tree={tree.id}>
        <rect x={x - tree.crownWidth * 500} y={top} width={tree.crownWidth * 1000} height={(bottom - top) / 3}/>
        <line x1={tree.bottom.x * 1000} y1={bottom} x2={x} y2={top}/>
        <circle cx={x} cy={top} r="2.5"/><circle cx={tree.bottom.x * 1000} cy={bottom} r="2.5"/>
        <text x={x + 4} y={top - 6}>{index + 1} · z {tree.top.z}</text>
      </g>;
    })}</svg>
  </div></div>;
}

/** Three independent wall-clock schedules, serviced by one sleeping timer.
 * Hidden/offscreen visits unload; returning resumes current time, without replay. */
export default memo(function TreeBirds({ sceneRef, location, reducedMotion, soloPreview = 0, flockPreview = 0, showMap = false }: {
  sceneRef: RefObject<HTMLDivElement>; location: string; reducedMotion: boolean; soloPreview?: number; flockPreview?: number; showMap?: boolean;
}) {
  const [visits, setVisits] = useState<TreeBirdVisit[]>([]);
  const latest = useRef({ soloPreview, flockPreview }); latest.current = { soloPreview, flockPreview };
  const refresh = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || reducedMotion) { setVisits([]); return; }
    let timer: ReturnType<typeof setTimeout> | undefined, visible = true;
    let solo = 0, flock = 0, previews: TreeBirdVisit[] = [];
    const update = () => {
      clearTimeout(timer);
      if (document.hidden || !visible) { setVisits([]); return; }
      const now = Date.now(), current = latest.current;
      if (current.soloPreview && current.soloPreview !== solo) {
        solo = current.soloPreview; previews = previews.filter(visit => visit.stream !== 'preview-solo');
        previews.push(previewTreeBirdVisit(now, location, solo, false));
      }
      if (current.flockPreview && current.flockPreview !== flock) {
        flock = current.flockPreview; previews = previews.filter(visit => visit.stream !== 'preview-flock');
        previews.push(previewTreeBirdVisit(now, location, flock, true));
      }
      previews = previews.filter(visit => now < visit.endAt);
      const scheduled = treeBirdSchedule(now, location), next = [...scheduled.visits, ...previews];
      setVisits(previous => previous.map(v => v.id).join('|') === next.map(v => v.id).join('|') ? previous : next.map(visit => previous.find(existing => existing.id === visit.id) ?? visit));
      const nextAt = Math.min(scheduled.nextAt, ...previews.map(visit => visit.endAt));
      timer = setTimeout(update, Math.max(30, nextAt - now));
    };
    refresh.current = update;
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; update(); });
    observer?.observe(scene); document.addEventListener('visibilitychange', update); update();
    return () => { clearTimeout(timer); observer?.disconnect(); document.removeEventListener('visibilitychange', update); refresh.current = undefined; };
  }, [sceneRef, location, reducedMotion]);
  useEffect(() => { refresh.current?.(); }, [soloPreview, flockPreview]);
  return <>{showMap && <TreeMapOverlay location={location}/>}{!reducedMotion && visits.length > 0 && <div className="f-tree-birds" data-layer="tree-birds" data-location={location} aria-hidden="true" style={{ '--tree-bird-sheet': `url("${artwork('visitors/tree-birds/flight-sheet.svg')}")`, ...birdPlane(location) } as CSSProperties}>
    <div className="f-tree-bird-frame" style={lakeFrame(location)}>{visits.map(visit => <BirdFlight key={visit.id} visit={visit}/>)}</div>
  </div>}</>;
});
