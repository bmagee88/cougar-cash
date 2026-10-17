import React, { CSSProperties, memo, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { artwork } from '../engine/artwork';
import { previewTreeBirdVisit, TreeBirdVisit, treeBirdPose, treeBirdSchedule } from '../engine/treeBirds';
import { lakeFrame } from './lakeFrame';
import { birdPlane, DistantTree, foregroundTreesForLocation, mappedTreesForLocation, TreeFrame, TreePoint, treesForLocation } from './treeMap';
import { BACKGROUND_PARALLAX, BIRCH_SEAT, DOCK_PARALLAX, shoreFrameStyle } from './manifest';

const SAMPLES = 60;
function framePoint(point: TreePoint, frame: TreeFrame | undefined, axis: 'x' | 'y', tree?: DistantTree) {
  const size = axis === 'x' ? 'w' : 'h', origin = axis === 'x' ? 'left' : 'top';
  let coordinate = String(point[axis]);
  if (frame === 'foreground' && tree) {
    // On wide displays the top of the close tree is cropped. Use the upper
    // third of its visible trunk, so birds still reach the actual tree on screen.
    const span = tree.bottom.y - tree.top.y, fraction = (point.y - tree.top.y) / span;
    const top = `max(${tree.top.y},min(${tree.bottom.y},var(--bird-near-crop-top,0)))`;
    const y = `calc(${top} + (${tree.bottom.y} - ${top}) * ${fraction})`;
    coordinate = axis === 'y' ? y : `calc(${point.x} + (${y} - ${point.y}) * ${(tree.bottom.x - tree.top.x) / span})`;
  }
  return frame === 'foreground'
    ? `calc(var(--bird-near-${origin},0px) + var(--bird-near-${size},var(--bird-plane-${size})) * ${coordinate})`
    : `calc(var(--bird-plane-${size}) * ${point[axis]})`;
}

/** Measure only on layout changes. CSS then projects between the two frames,
 * including their different parallax, without measuring on animation frames. */
function useBirdForegroundFrame(sceneRef: RefObject<HTMLDivElement>, root: RefObject<HTMLDivElement>, location: string, active: boolean) {
  useLayoutEffect(() => {
    const scene = sceneRef.current, birds = root.current;
    if (!scene || !birds || !active || !foregroundTreesForLocation(location).length) return;
    const landscape = scene.querySelector<HTMLElement>(`[data-layer="${location === 'birch' ? 'birch-mountains' : 'cove-landscape'}"]`);
    const foreground = scene.querySelector<HTMLElement>(`[data-layer="${location === 'birch' ? 'birch-trunks' : 'cove-seat'}"]`);
    if (!landscape || !foreground) return;
    const offset = (element: HTMLElement) => {
      let left = 0, top = 0;
      for (let node: HTMLElement | null = element; node && node !== scene; node = node.offsetParent as HTMLElement | null) {
        left += node.offsetLeft; top += node.offsetTop;
      }
      return { left, top };
    };
    const measure = () => {
      const far = offset(landscape), near = offset(foreground);
      birds.style.setProperty('--bird-near-left', `${near.left - far.left}px`);
      birds.style.setProperty('--bird-near-top', `${near.top - far.top}px`);
      birds.style.setProperty('--bird-near-w', `${foreground.offsetWidth}px`);
      birds.style.setProperty('--bird-near-h', `${foreground.offsetHeight}px`);
      birds.style.setProperty('--bird-near-crop-top', String(Math.max(0, -near.top / (foreground.offsetHeight || 1))));
      const ground = foreground.closest<HTMLElement>('.f-cove-ground-plane');
      birds.style.setProperty('--bird-near-parallax', ground?.style.getPropertyValue('--ground-parallax') || String(DOCK_PARALLAX));
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    [scene, landscape, foreground].forEach(element => observer?.observe(element));
    foreground.addEventListener('load', measure); window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); foreground.removeEventListener('load', measure); window.removeEventListener('resize', measure); };
  }, [sceneRef, root, location, active]);
}

function BirdFlight({ visit }: { visit: TreeBirdVisit }) {
  // Preserve the starting delay across world-clock renders and stepped updates.
  const [age] = useState(() => Math.max(0, Date.now() - visit.startAt));
  const styles = useMemo(() => visit.birds.map(route => {
    const trees = mappedTreesForLocation(visit.location);
    const source = trees.find(tree => tree.id === route.fromTree), target = trees.find(tree => tree.id === route.toTree);
    const fromX = framePoint(route.from, route.fromFrame, 'x', source), toX = framePoint(route.to, route.toFrame, 'x', target);
    const fromY = framePoint(route.from, route.fromFrame, 'y', source), toY = framePoint(route.to, route.toFrame, 'y', target);
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
      const nearWeight = (route.fromFrame === 'foreground' ? 1 - pose.blend : 0) + (route.toFrame === 'foreground' ? pose.blend : 0);
      style[`--bx${i}`] = `calc(${fromX} * ${1 - pose.blend} + ${toX} * ${pose.blend} + var(--scene-x,0px) * ${nearWeight} * (var(--bird-near-parallax,${DOCK_PARALLAX}) - ${BACKGROUND_PARALLAX}))`;
      style[`--by${i}`] = `calc(${fromY} * ${1 - pose.blend} + ${toY} * ${pose.blend} + var(--bird-plane-h) * ${pose.arc} - var(--scene-y,0px) * ${nearWeight * BACKGROUND_PARALLAX})`;
      style[`--bs${i}`] = pose.scale;
      style[`--bo${i}`] = pose.opacity; style[`--ba${i}`] = `${angle}deg`;
    }
    return style as CSSProperties;
  }), [visit, age]);
  return <div data-bird-visit={visit.id} data-bird-stream={visit.stream} data-bird-count={visit.birds.length}>
    {visit.birds.map((route, index) => <span key={index} className="f-tree-bird" data-from-tree={route.fromTree} data-to-tree={route.toTree ?? 'offscreen'} data-from-frame={route.fromFrame ?? 'landscape'} data-to-frame={route.toFrame ?? 'landscape'} data-start-z={route.from.z} data-end-z={route.to.z} style={styles[index]}>
      <i className="f-tree-bird-wing" />
    </span>)}
  </div>;
}

export function TreeMapOverlay({ location }: { location: string }) {
  const markers = (trees: DistantTree[], offset = 0) => <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">{trees.map((tree, index) => {
      const x = tree.top.x * 1000, top = tree.top.y * 1000, bottom = tree.bottom.y * 1000;
      return <g key={tree.id} data-mapped-tree={tree.id}>
        <rect x={x - tree.crownWidth * 500} y={top} width={tree.crownWidth * 1000} height={(bottom - top) / 3}/>
        <line x1={tree.bottom.x * 1000} y1={bottom} x2={x} y2={top}/>
        <circle cx={x} cy={top} r="2.5"/><circle cx={tree.bottom.x * 1000} cy={bottom} r="2.5"/>
        <text x={x + 4} y={Math.max(12, top - 6)}>{index + offset + 1} · z {tree.top.z}</text>
      </g>;
    })}</svg>;
  const foreground = foregroundTreesForLocation(location);
  return <div className="f-tree-map" data-layer="tree-map" aria-hidden="true">
    <div style={lakeFrame(location)}>{markers(treesForLocation(location))}</div>
    {foreground.length > 0 && <div className="f-cove-ground-plane f-tree-map-foreground" style={shoreFrameStyle(location, location === 'birch' ? BIRCH_SEAT.x : .29) as CSSProperties}>{markers(foreground, 10)}</div>}
  </div>;
}

/** Three independent wall-clock schedules, serviced by one sleeping timer.
 * Hidden/offscreen visits unload; returning resumes current time, without replay. */
export default memo(function TreeBirds({ sceneRef, location, reducedMotion, soloPreview = 0, flockPreview = 0, showMap = false }: {
  sceneRef: RefObject<HTMLDivElement>; location: string; reducedMotion: boolean; soloPreview?: number; flockPreview?: number; showMap?: boolean;
}) {
  const [visits, setVisits] = useState<TreeBirdVisit[]>([]);
  const root = useRef<HTMLDivElement>(null);
  useBirdForegroundFrame(sceneRef, root, location, !reducedMotion && visits.length > 0);
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
  return <>{showMap && <TreeMapOverlay location={location}/>}{!reducedMotion && visits.length > 0 && <div ref={root} className="f-tree-birds" data-layer="tree-birds" data-location={location} aria-hidden="true" style={{ '--tree-bird-sheet': `url("${artwork('visitors/tree-birds/flight-sheet.svg')}")`, ...birdPlane(location) } as CSSProperties}>
    <div className="f-tree-bird-frame" style={lakeFrame(location)}>{visits.map(visit => <BirdFlight key={visit.id} visit={visit}/>)}</div>
  </div>}</>;
});
