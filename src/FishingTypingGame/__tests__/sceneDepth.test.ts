import {advanceSceneDepth,changeSceneDepth,depthAtWaterline,depthScale,foregroundClearance,groundPerspective,perspectiveRatio,reframeSceneDepth,sceneDepthFrame,sceneHorizon,SCENE_DEPTH,waterlineAtDepth} from '../scene/sceneDepth';
import {createFlight,stepFlight} from '../scene/butterflyFlight';
import {stepOdonate} from '../scene/odonateFlight';
import {mappedTreesForLocation} from '../scene/treeMap';
import {plantsForLocation} from '../scene/plantMap';

declare const test:any,expect:any;

test('depth projects both axes and size toward the shoreline, and reverses without accumulated drift',()=>{
  for(const horizon of [.42,.5,.555]){
    const original={x:.82,y:.8,z:SCENE_DEPTH.arrival},point={...original},incremental={...original};
    changeSceneDepth(point,.98,horizon);
    for(let n=1;n<=100;n++)changeSceneDepth(incremental,original.z+(.98-original.z)*n/100,horizon);
    expect(point.x).toBeGreaterThan(.5);expect(point.x).toBeLessThan(.54);
    expect(point.y).toBeGreaterThan(horizon);expect(point.y-horizon).toBeLessThan(.04);
    expect((point.y-horizon)/(original.y-horizon)).toBeCloseTo(depthScale(.98)/depthScale(original.z));
    expect(incremental.x).toBeCloseTo(point.x,12);expect(incremental.y).toBeCloseTo(point.y,12);
    changeSceneDepth(point,original.z,horizon);
    expect(point.x).toBeCloseTo(original.x,12);expect(point.y).toBeCloseTo(original.y,12);
    const airborne={x:.2,y:.2,z:original.z};changeSceneDepth(airborne,.8,horizon);
    expect(airborne.y).toBeGreaterThan(.2);expect(airborne.y).toBeLessThan(horizon);
  }
});

test('water position and distance are inverse, with clamped near and far limits',()=>{
  for(const horizon of [.42,.5,.555])for(const z of [0,.03,.06,.14,.5,.8,1]){
    expect(depthAtWaterline(waterlineAtDepth(z,horizon),horizon)).toBeCloseTo(z,12);
    expect(waterlineAtDepth(z,horizon)).toBeGreaterThan(horizon);
  }
  expect(depthAtWaterline(1.2)).toBe(0);expect(depthAtWaterline(.2)).toBe(1);
  const point={x:.6,y:.8,z:.06};changeSceneDepth(point,12);expect(point.z).toBe(1);
  changeSceneDepth(point,-2);expect(point.z).toBe(0);
});

test('each location puts the foreground water boundary at the angler feet while retaining the far shoreline',()=>{
  for(const [horizon,feetY] of [[.5,.96],[.555,.87],[.5,.86]] as const){
    const camera={horizon,...groundPerspective(horizon,feetY)};
    expect(waterlineAtDepth(camera.foreground,horizon,camera)).toBeCloseTo(feetY,12);
    expect(depthAtWaterline(feetY,horizon,camera)).toBeCloseTo(camera.foreground,12);
    expect(waterlineAtDepth(0,horizon,camera)).toBe(1);
    expect(perspectiveRatio(1,camera)).toBeCloseTo(1/25,12);
    let previous=Infinity;
    for(const z of [0,.02,.06,.14,.3,.5,.8,.98,1]){
      const ground=waterlineAtDepth(z,horizon,camera);
      expect(ground).toBeLessThan(previous);previous=ground;
      expect(depthAtWaterline(ground,horizon,camera)).toBeCloseTo(z,10);
    }
    // A point at ankle level stays at ankle level after lateral movement and
    // follows the water plane exactly when moving away, then back again.
    const point={x:.75,y:feetY,z:camera.foreground};changeSceneDepth(point,.8,horizon,undefined,camera);
    expect(point.y).toBeCloseTo(waterlineAtDepth(.8,horizon,camera),12);
    changeSceneDepth(point,camera.foreground,horizon,undefined,camera);
    expect(point.y).toBeCloseTo(feetY,12);expect(point.x).toBeCloseTo(.75,12);
  }
});

test('responsive calibration uses the stable seated rig at every location and camera changes are reversible',()=>{
  const scene=document.createElement('div'),art=document.createElement('div'),rig=document.createElement('div'),animated=document.createElement('div');
  rig.className='f-angler-shadow-rig';animated.className='f-character';scene.append(art,rig,animated);
  animated.getBoundingClientRect=()=>({left:0,top:0,width:300,height:400} as DOMRect);
  for(const [location,layer] of [['dock','lake-background'],['cove','cove-landscape'],['birch','birch-treeline-water']] as const){
    art.dataset.layer=layer;
    const cameras=[[1440,900],[800,600],[390,844]].map(([width,height])=>{
      const bounds={left:20,top:60,width,height} as DOMRect;
      art.getBoundingClientRect=()=>({left:20,top:60,width,height} as DOMRect);
      rig.getBoundingClientRect=()=>({left:20+width*.22,top:60+height*.6,width:width*.15,height:height*.3} as DOMRect);
      const camera=sceneDepthFrame(scene,location,bounds);
      expect(camera.feet!.y).toBeCloseTo(.6+.3*.93,12);
      expect(camera.feet!.x).toBeCloseTo(.22+.15*.8,12);
      expect(waterlineAtDepth(camera.foreground,camera.horizon,camera)).toBeCloseTo(camera.feet!.y,12);
      return camera;
    });
    const from=cameras[0],to={...cameras[1],horizon:.45,...groundPerspective(.45,.92)};
    const point={x:.72,y:.8,z:.1};reframeSceneDepth(point,from,to);reframeSceneDepth(point,to,from);
    expect(point.x).toBeCloseTo(.72,12);expect(point.y).toBeCloseTo(.8,12);expect(point.z).toBe(.1);
  }
});

test('calibrated foreground collisions still stop one depth unit before the painted angler plane',()=>{
  const camera=groundPerspective(.555,.88);
  for(const [from,to,sign] of [[0,.8,-1],[.8,0,1]]){
    const point={x:.7,y:waterlineAtDepth(from,.555,camera),z:from},hits:number[][]=[];
    expect(changeSceneDepth(point,to,.555,(x,y)=>{hits.push([x,y]);return true;},camera)).toBe(true);
    expect(hits[0][1]).toBeCloseTo(.88,12);expect(point.z).toBeCloseTo(camera.foreground+sign*foregroundClearance(camera),12);
  }
});

test('depth travel and apparent approach slow with distance, remain frame independent and reverse cleanly',()=>{
  for(const camera of [undefined,groundPerspective(.5,.987),groundPerspective(.555,.795),groundPerspective(.5,.853)]){
    let previousTravel=Infinity,previousProjection=Infinity;
    for(const z of [.01,.08,.2,.5,.8]){
      const next=advanceSceneDepth(z,.22,.05,camera),point={x:.8,y:waterlineAtDepth(z,.5,camera),z};
      changeSceneDepth(point,next,.5,undefined,camera);
      const projected=Math.hypot(point.x-.8,point.y-waterlineAtDepth(z,.5,camera));
      expect(next-z).toBeLessThanOrEqual(previousTravel+1e-12);previousTravel=next-z;
      expect(projected).toBeLessThan(previousProjection);previousProjection=projected;
    }
    const once=advanceSceneDepth(.2,.22,1,camera);let stepped=.2;
    for(let i=0;i<120;i++)stepped=advanceSceneDepth(stepped,.22,1/120,camera);
    expect(stepped).toBeCloseTo(once,12);expect(advanceSceneDepth(once,-.22,1,camera)).toBeCloseTo(.2,12);
  }
});

test('natural butterflies, dragonflies and damselflies share the same depth-only projection',()=>{
  for(const kind of ['butterfly','dragonfly','damselfly'] as const){
    const flight={...createFlight(()=>.5),x:.7,y:.7,z:.06,vx:0,vy:0,vz:.2,mode:'hover' as const,turnIn:100,modeIn:100};
    const expected={...flight};changeSceneDepth(expected,.08,.55);
    if(kind==='butterfly')stepFlight(flight,.1,800,600,()=>.5,undefined,.55);
    else stepOdonate(flight,kind,.1,800,600,()=>.5,undefined,.55);
    expect(flight.x).toBeCloseTo(expected.x,12);expect(flight.z).toBeCloseTo(expected.z,12);
    // Jewelwings add a small wingbeat flutter; the main displacement still recedes.
    expect(flight.y).toBeLessThan(.7);expect(Math.abs(flight.y-expected.y)).toBeLessThan(.005);
  }
});

test('shoreline measurement accounts for the rendered artwork crop and location',()=>{
  const scene=document.createElement('div'),art=document.createElement('div');scene.append(art);
  const bounds={top:100,left:0,width:800,height:600} as DOMRect;
  art.getBoundingClientRect=()=>({top:40,height:800} as DOMRect);
  for(const [location,layer,sourceY] of [['dock','lake-background',.5],['cove','cove-landscape',.555],['birch','birch-treeline-water',.5]] as const){
    art.dataset.layer=layer;expect(sceneHorizon(scene,location,bounds)).toBeCloseTo((40-100+800*sourceY)/600);
  }
});

test('all locations use normalized distance for shore trees and foreground plants',()=>{
  for(const location of ['dock','cove','birch']){
    mappedTreesForLocation(location).forEach(tree=>{
      expect(tree.top.z).toBeGreaterThan(0);expect(tree.top.z).toBeLessThanOrEqual(1);
      if(tree.frame==='foreground')expect(tree.top.z).toBeLessThan(SCENE_DEPTH.foreground);
      else expect(tree.top.z).toBeGreaterThan(SCENE_DEPTH.foreground);
    });
    plantsForLocation(location,'summer','2026-10-17').forEach(plant=>{expect(plant.z).toBeGreaterThanOrEqual(0);expect(plant.z).toBeLessThanOrEqual(1);});
  }
});

test('swept depth crossing tests the projected foreground intersection, with a gap on either side',()=>{
  for(const [from,to,stop] of [[.03,.8,.139],[.8,.03,.141]]){
    const point={x:.3,y:.3,z:from},intersection={...point};changeSceneDepth(intersection,.14);
    const hits:number[][]=[];
    expect(changeSceneDepth(point,to,.5,(x,y)=>{hits.push([x,y]);return true;})).toBe(true);
    expect(hits[0][0]).toBeCloseTo(intersection.x,12);expect(hits[0][1]).toBeCloseTo(intersection.y,12);
    expect(point.z).toBeCloseTo(stop,12);
    expect(changeSceneDepth(point,to,.5,()=>false)).toBe(false);expect(point.z).toBe(to);
  }
});

test('wild odonates stop their depth course at scenery and have a strong distance slowdown',()=>{
  for(const kind of ['dragonfly','damselfly'] as const){
    const near={...createFlight(()=>.5),x:.5,y:.3,z:.06,vx:150,vy:60,vz:0,turnIn:100,mode:'hover' as const};
    const far={...near,z:.8};
    stepOdonate(near,kind,.1,800,600,()=>.5);stepOdonate(far,kind,.1,800,600,()=>.5);
    expect(far.x-.5).toBeLessThan((near.x-.5)*.05);expect(far.y-.3).toBeLessThan((near.y-.3)*.05);
    const blocked={...near,x:.2,y:.3,z:.13,vz:.2};
    stepOdonate(blocked,kind,.1,800,600,()=>.5,undefined,.5,()=>true);
    expect(blocked.z).toBeCloseTo(.139,12);expect(blocked.vz).toBe(0);expect(blocked.turnIn).toBe(0);
  }
});
