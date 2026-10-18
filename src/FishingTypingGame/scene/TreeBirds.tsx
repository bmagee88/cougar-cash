import React, { CSSProperties, memo, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { artwork } from '../engine/artwork';
import { previewTreeBirdFlyby, previewTreeBirdVisit, TREE_BIRD_DIRECTIONS, TREE_BIRD_SPECIES, TreeBirdRoute, TreeBirdVisit, treeBirdDirection, treeBirdPose, treeBirdSchedule, usesSpeciesBirdArt } from '../engine/treeBirds';
import { lakeFrame } from './lakeFrame';
import { birdPlane, bushesForLocation, DistantTree, foregroundTreesForLocation, mappedTreesForLocation, TreeFrame, TreePoint, treesForLocation } from './treeMap';
import { BACKGROUND_PARALLAX, BIRCH_SEAT, DOCK_PARALLAX, shoreFrameStyle } from './manifest';
import { BirdPose, birdById, birdSheet, TreeBirdSpeciesId } from '../engine/birds';
import { foregroundOccludes } from './ButterflyVisitors';

export type ObserveBird=(target:HTMLButtonElement,speciesId:TreeBirdSpeciesId,pose:BirdPose)=>void;

const SAMPLES = 60;
function framePoint(point: TreePoint, frame: TreeFrame | undefined, axis: 'x' | 'y', tree?: DistantTree) {
  const size = axis === 'x' ? 'w' : 'h', origin = axis === 'x' ? 'left' : 'top';
  if(frame==='viewer')return `calc(var(--bird-view-${origin}) + 100cq${axis==='x'?'w':'h'} * ${point[axis]})`;
  let coordinate = String(point[axis]);
  if (frame === 'foreground' && tree && tree.kind!=='bush') {
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

function BirdFlight({ visit, sceneRef, collected, onObserve }: { visit: TreeBirdVisit; sceneRef:RefObject<HTMLDivElement>; collected:Map<string,number>; onObserve?:ObserveBird }) {
  // Preserve the starting delay across world-clock renders and stepped updates.
  const [age] = useState(() => Math.max(0, Date.now() - visit.startAt));
  const [,redraw]=useState(0);
  // Pointer collection begins on press, before the bird can fly out from under
  // the release. Native clicks also support keyboard/assistive activation.
  const collect=(event:React.MouseEvent<HTMLButtonElement>,route:TreeBirdRoute,index:number)=>{
    const elapsed=Date.now()-visit.startAt-route.delayMs;
    const currentPose=treeBirdPose(route,elapsed/route.durationMs);
    if(!onObserve||!route.species||collected.has(`${visit.id}:${index}`)||elapsed<0||elapsed>=route.durationMs||currentPose.opacity<=0)return;
    const keyboard=event.detail===0&&event.clientX===0&&event.clientY===0;
    if(!keyboard&&currentPose.layer<=7&&sceneRef.current&&foregroundOccludes(sceneRef.current,event.clientX,event.clientY))return;
    const button=event.currentTarget;
    // Sample the current CSS pose only on collection, with no frame loop.
    const brake=button.querySelector<HTMLElement>('.f-tree-bird-brake'),glide=button.querySelector<HTMLElement>('.f-tree-bird-glide');
    const pose=brake&&Number(getComputedStyle(brake).opacity)>0?brake:glide&&Number(getComputedStyle(glide).opacity)>0?glide:button.querySelector<HTMLElement>('.f-tree-bird-wingbeat')!;
    const frame=Math.max(0,Math.min(11,Math.round((parseFloat(getComputedStyle(pose).backgroundPositionX)||0)*11/100)));
    event.stopPropagation();
    collected.set(`${visit.id}:${index}`,visit.endAt);redraw(version=>version+1);
    onObserve(button,route.species,{direction:treeBirdDirection(route),frame});
  };
  const styles = useMemo(() => visit.birds.map(route => {
    const trees = mappedTreesForLocation(visit.location);
    const source = trees.find(tree => tree.id === route.fromTree), target = trees.find(tree => tree.id === route.toTree);
    const fromX = framePoint(route.from, route.fromFrame, 'x', source), toX = framePoint(route.to, route.toFrame, 'x', target);
    const fromY = framePoint(route.from, route.fromFrame, 'y', source), toY = framePoint(route.to, route.toFrame, 'y', target);
    const style: Record<string, string | number> = {
      '--bird-duration': `${route.durationMs}ms`, '--bird-delay': `${route.delayMs - age}ms`,
      '--bird-bound-period': `${route.durationMs / route.bounds}ms`, '--bird-wing-phase': `${-route.phase * route.durationMs / route.bounds}ms`,
      '--bird-face': route.to.x > route.from.x ? 1 : -1,
      '--bird-species-sheet': `url("${birdSheet(route.species??'sparrow')}")`,
      '--bird-species-row': `${TREE_BIRD_DIRECTIONS.indexOf(treeBirdDirection(route))*20}%`,
      '--bird-species-phase': `${route.delayMs-age-route.phase*route.durationMs/route.bounds}ms`,
    };
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES, pose = treeBirdPose(route, t);
      const before = treeBirdPose(route, Math.max(0, t - .002)), after = treeBirdPose(route, Math.min(1, t + .002));
      const direction = route.to.x > route.from.x ? 1 : -1;
      const angle = Math.max(-28, Math.min(28, Math.atan2(after.y - before.y, Math.abs(after.x - before.x) || .00001) * 180 / Math.PI * direction));
      const nearWeight = (route.fromFrame === 'foreground' ? pose.fromWeight : 0) + (route.toFrame === 'foreground' ? pose.toWeight : 0);
      style[`--bx${i}`] = `calc(${fromX} * ${pose.fromWeight} + ${toX} * ${pose.toWeight} + var(--bird-plane-w) * ${pose.centerWeight*.5} + var(--scene-x,0px) * (${BACKGROUND_PARALLAX} + ${nearWeight} * (var(--bird-near-parallax,${DOCK_PARALLAX}) - ${BACKGROUND_PARALLAX})))`;
      style[`--by${i}`] = `calc(${fromY} * ${pose.fromWeight} + ${toY} * ${pose.toWeight} + var(--bird-plane-h) * ${pose.arc+pose.centerWeight*.52} + var(--scene-y,0px) * ${(1-nearWeight)*BACKGROUND_PARALLAX})`;
      style[`--bs${i}`] = pose.scale;
      style[`--bo${i}`] = `calc(${pose.opacity} * (.90 - var(--weather-veil,0) * .25))`; style[`--ba${i}`] = `${angle}deg`; style[`--bz${i}`]=pose.layer;
    }
    return style as CSSProperties;
  }), [visit, age]);
  return <div data-bird-visit={visit.id} data-bird-stream={visit.stream} data-bird-count={visit.birds.length}>
    {visit.birds.map((route, index) => collected.has(`${visit.id}:${index}`)?null:<span key={index} className="f-tree-bird" data-from-tree={route.fromTree} data-to-tree={route.toTree ?? 'offscreen'} data-from-frame={route.fromFrame ?? 'landscape'} data-to-frame={route.toFrame ?? 'landscape'} data-start-z={route.from.z} data-end-z={route.to.z}
      data-bird-species={route.species} data-bird-can-flock={TREE_BIRD_SPECIES.find(species=>species.id===route.species)?.canFlock}
      data-bird-art={usesSpeciesBirdArt(route)?'species':'silhouette'} data-bird-direction={treeBirdDirection(route)} style={styles[index]}>
      {usesSpeciesBirdArt(route)?<button type="button" className="f-tree-bird-species" data-bird-landing={!!route.toTree}
        aria-label={`Observe ${birdById(route.species)?.name.toLowerCase()}`} title="Add this bird to your field guide" disabled={!onObserve}
        onPointerDown={event=>{if(event.button===0)collect(event,route,index);}}
        onClick={event=>collect(event,route,index)}>
        <i className="f-tree-bird-cruise"><i className="f-tree-bird-wingbeat"/><i className="f-tree-bird-glide"/></i>
        {route.toTree&&<i className="f-tree-bird-brake"/>}
      </button>:<i className="f-tree-bird-wing" aria-hidden="true" />}
    </span>)}
  </div>;
}

export function TreeMapOverlay({ location }: { location: string }) {
  const markers = (trees: DistantTree[], offset = 0) => <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">{trees.map((tree, index) => {
      const x = tree.top.x * 1000, top = tree.top.y * 1000, bottom = tree.bottom.y * 1000;
      return <g key={tree.id} data-mapped-tree={tree.id} data-tree-kind={tree.kind??'tree'}>
        <rect x={x - tree.crownWidth * 500} y={top} width={tree.crownWidth * 1000} height={(bottom - top) / 3}/>
        <line x1={tree.bottom.x * 1000} y1={bottom} x2={x} y2={top}/>
        <circle cx={x} cy={top} r="2.5"/><circle cx={tree.bottom.x * 1000} cy={bottom} r="2.5"/>
        <text x={x + 4} y={Math.max(12, top - 6)}>{index + offset + 1}{tree.kind==='bush'?' bush':''} · z {tree.top.z}</text>
      </g>;
    })}</svg>;
  const foreground = [...foregroundTreesForLocation(location),...bushesForLocation(location)];
  return <div className="f-tree-map" data-layer="tree-map" aria-hidden="true">
    <div style={lakeFrame(location)}>{markers(treesForLocation(location))}</div>
    {foreground.length > 0 && <div className="f-cove-ground-plane f-tree-map-foreground" style={shoreFrameStyle(location, location === 'birch' ? BIRCH_SEAT.x : .29) as CSSProperties}>{markers(foreground, 10)}</div>}
  </div>;
}

/** Three independent wall-clock schedules, serviced by one sleeping timer.
 * Hidden/offscreen visits unload; returning resumes current time, without replay. */
export default memo(function TreeBirds({ sceneRef, location, reducedMotion, soloPreview = 0, flockPreview = 0, flybyPreview=0, showMap = false, onObserve }: {
  sceneRef: RefObject<HTMLDivElement>; location: string; reducedMotion: boolean; soloPreview?: number; flockPreview?: number; flybyPreview?:number; showMap?: boolean; onObserve?:ObserveBird;
}) {
  const [visits, setVisits] = useState<TreeBirdVisit[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const collected=useRef(new Map<string,number>());
  useBirdForegroundFrame(sceneRef, root, location, !reducedMotion && visits.length > 0);
  const latest = useRef({ soloPreview, flockPreview,flybyPreview }); latest.current = { soloPreview, flockPreview,flybyPreview };
  const refresh = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || reducedMotion) { setVisits([]); return; }
    let timer: ReturnType<typeof setTimeout> | undefined, visible = true;
    let solo = 0, flock = 0, flyby=0, previews: TreeBirdVisit[] = [];
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      collected.current.forEach((expires,id)=>{if(now>=expires)collected.current.delete(id);});
      if (document.hidden || !visible) { setVisits([]); return; }
      const current = latest.current;
      if (current.soloPreview && current.soloPreview !== solo) {
        solo = current.soloPreview; previews = previews.filter(visit => visit.stream !== 'preview-solo');
        previews.push(previewTreeBirdVisit(now, location, solo, false));
      }
      if (current.flockPreview && current.flockPreview !== flock) {
        flock = current.flockPreview; previews = previews.filter(visit => visit.stream !== 'preview-flock');
        previews.push(previewTreeBirdVisit(now, location, flock, true));
      }
      if(current.flybyPreview&&current.flybyPreview!==flyby){
        flyby=current.flybyPreview;previews=previews.filter(visit=>visit.stream!=='preview-flyby');
        previews.push(previewTreeBirdFlyby(now,location,flyby));
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
  useEffect(() => { refresh.current?.(); }, [soloPreview, flockPreview,flybyPreview]);
  return <>{showMap && <TreeMapOverlay location={location}/>}{!reducedMotion && visits.length > 0 && <div ref={root} className="f-tree-birds" data-layer="tree-birds" data-location={location} aria-hidden={onObserve?undefined:true} style={{ '--tree-bird-sheet': `url("${artwork('visitors/tree-birds/flight-sheet.svg')}")`, ...birdPlane(location) } as CSSProperties}>
    <div className="f-tree-bird-frame" style={lakeFrame(location)}>{visits.map(visit => <BirdFlight key={visit.id} visit={visit} sceneRef={sceneRef} collected={collected.current} onObserve={onObserve}/>)}</div>
  </div>}</>;
});
