import {makeTreeBirdVisit} from '../engine/treeBirds';
import {mappedTreesForLocation} from '../scene/treeMap';
import {createFlight} from '../scene/butterflyFlight';
import {stepOdonate} from '../scene/odonateFlight';

declare const test:any,expect:any;

test('only hidden-tree routes take four times as long, with the same flight shape',()=>{
  const trees=mappedTreesForLocation('cove');
  const source=trees.find(tree=>tree.frame==='landscape')!;
  const hidden=trees.find(tree=>tree.hidden)!;
  const visible={...hidden,hidden:false};
  const make=(target:typeof hidden)=>makeTreeBirdVisit('speed','solo',0,123,'cove',1,{source,target}).birds[0];
  const slow=make(hidden),normal=make(visible);
  expect(slow.durationMs).toBe(normal.durationMs*4);
  expect(slow.bounds).toBe(normal.bounds);
  expect(slow.from).toEqual(normal.from);expect(slow.to).toEqual(normal.to);
  const reverse=(hiddenFlag:boolean)=>makeTreeBirdVisit('return','solo',0,123,'cove',1,{source:{...hidden,hidden:hiddenFlag},target:source}).birds[0];
  expect(reverse(true).durationMs).toBe(reverse(false).durationMs*4);
});

test('both odonates ramp from rest for half a second and then retain full cruising speed',()=>{
  for(const kind of ['dragonfly','damselfly'] as const){
    const base={...createFlight(()=>.5),x:.5,y:.4,z:.03,age:1,turnIn:10,vx:200,vy:0,vz:0,motionVx:200,motionVy:0,departAt:100};
    const launch={...base,odonateLaunchElapsed:0},cruise={...base};
    const fractions:number[]=[];
    for(let frame=0;frame<6;frame++){
      const a=launch.x,b=cruise.x;
      stepOdonate(launch,kind,.1,10000,10000,()=>.5);
      stepOdonate(cruise,kind,.1,10000,10000,()=>.5);
      fractions.push((launch.x-a)/(cruise.x-b));
    }
    [.1,.3,.5,.7,.9,1].forEach((value,index)=>expect(fractions[index]).toBeCloseTo(value,6));
    const stopped={...base,vx:0,vy:0,turnIn:0};
    stepOdonate(stopped,kind,.1,10000,10000,()=>.9);
    expect(stopped.odonateLaunchElapsed).toBeCloseTo(.1);
  }
});
