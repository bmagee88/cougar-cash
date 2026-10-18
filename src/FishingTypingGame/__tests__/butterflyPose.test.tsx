import React from 'react';
import { render, within } from '@testing-library/react';
import { blankEntry, saveNotebookEntry } from '../engine/notebook';
import { deserializeSave, emptySave } from '../engine/storage';
import { readButterflyPose } from '../engine/butterflies';
import NotebookIllustration from '../components/NotebookIllustration';
import ButterflyGuide from '../components/ButterflyGuide';
import { configureButterflyFlight, createFlight, isPerched, stepFlight } from '../scene/butterflyFlight';
import { planPlantVisit } from '../scene/plantMap';
import { paintVisitor, RenderedVisitor, Visitor } from '../scene/ButterflyVisitors';

declare const test:any,expect:any,jest:any;

test('butterflies can land in profile facing either way and keep that view through resting wingbeats',()=>{
  const context={clearRect:jest.fn(),save:jest.fn(),restore:jest.fn(),translate:jest.fn(),rotate:jest.fn(),scale:jest.fn(),drawImage:jest.fn()};
  const canvasContext=jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  try{
    for(const approach of [-1,1]){
      const flight={...createFlight(()=>.5),x:.5+approach*.0005,y:.65,z:.03,vx:-approach*100,departAt:100};
      configureButterflyFlight(flight,'monarch',()=>.5);
      planPlantVisit(flight,[{id:'bloom',label:'Bloom',layer:'bloom',kind:'flower',uses:['butterfly'],x:.5,y:.65,z:.03}],'butterfly',()=>0);
      flight.perch!.startAt=0;
      const visitor:Visitor={id:1,speciesId:'monarch',wingspanMm:90,size:20,flight};
      const button=document.createElement('button'),canvas=document.createElement('canvas');button.appendChild(canvas);
      const dorsal=new Image(),side=new Image(),target:RenderedVisitor={button,canvas,sprite:{image:dorsal,frameMs:65},sideSprite:{image:side,frameMs:65}};
      // The slow final approach already uses the selected profile.
      flight.vx=-approach*14;paintVisitor(visitor,target);expect(target.pose?.view).toBe('side');
      stepFlight(flight,.02,800,600,()=>0);
      expect(isPerched(flight)).toBe(true);expect(flight.vx).toBe(0);
      flight.motionVx=approach*100;
      for(let n=0;n<5;n++){
        stepFlight(flight,.1,800,600,()=>0);paintVisitor(visitor,target);
        expect(target.pose).toMatchObject({view:'side',frame:flight.perch!.frame,flipped:approach>0});
        expect(flight.x).toBe(.5);expect(flight.y).toBe(.65);
      }
      expect(context.drawImage).toHaveBeenLastCalledWith(side,flight.perch!.frame*96,0,96,112,-48,-56,96,112);
      const entry=blankEntry('side-landing',new Date().toISOString(),'dock',{kind:'butterfly',speciesId:'monarch',wingspanMm:90,pose:target.pose});
      const saved=saveNotebookEntry(emptySave(),entry.id,{title:'On a bloom'},entry);
      expect(deserializeSave(JSON.stringify(saved)).notebook![0].image).toMatchObject({pose:target.pose});
      // Optional artwork can fall back without leaving a blank canvas.
      target.sideSprite=undefined;paintVisitor(visitor,target);expect(target.pose?.view).toBeUndefined();
      expect(context.drawImage.mock.calls[context.drawImage.mock.calls.length-1][0]).toBe(dorsal);
    }
    const flight=createFlight(()=>.5);configureButterflyFlight(flight,'monarch',()=>.5);
    planPlantVisit(flight,[{id:'bloom',label:'Bloom',layer:'bloom',kind:'flower',uses:['butterfly'],x:.5,y:.65,z:.03}],'butterfly',()=>.9);
    expect(flight.perch!.sideways).toBe(false);
  }finally{canvasContext.mockRestore();}
});

test('every clicked wing stage survives recording and reload with its orientation',()=>{
  for(let frame=0;frame<8;frame++){
    const pose={frame,rotation:-.25,flipped:frame%2===0};
    const entry=blankEntry(`pose-${frame}`,new Date().toISOString(),'dock',{kind:'butterfly',speciesId:'monarch',wingspanMm:90,pose});
    const saved=saveNotebookEntry(emptySave(),entry.id,{title:'Resting on a reed'},entry);
    const image=deserializeSave(JSON.stringify(saved)).notebook![0].image!;
    expect(image).toEqual(entry.image);
    const view=render(<NotebookIllustration image={image} units="metric"/>);
    const illustration=view.getByRole('img',{name:'The butterfly you observed'});
    expect(illustration).toHaveAttribute('src',expect.stringContaining(`/monarch/pose-${frame}.webp`));
    expect(illustration).toHaveAttribute('data-wing-frame',String(frame));
    expect(illustration).toHaveStyle(`transform:rotate(-0.25rad) scaleX(${pose.flipped?-1:1})`);
    view.unmount();
  }
});

test('malformed wing poses are discarded and older journal entries keep their illustration',()=>{
  const pose={frame:3,rotation:0,flipped:false};
  [-1,8,2.5,'3',null].forEach(frame=>expect(readButterflyPose({...pose,frame})).toBeUndefined());
  [Infinity,NaN,'0'].forEach(rotation=>expect(readButterflyPose({...pose,rotation})).toBeUndefined());
  expect(readButterflyPose({...pose,flipped:'false'})).toBeUndefined();
  const view=render(<NotebookIllustration image={{kind:'butterfly',speciesId:'monarch'}} units="metric"/>);
  expect(view.getByRole('img')).toHaveAttribute('src',expect.stringContaining('/monarch/adult.webp'));
});

test('discovered caterpillars animate while unknown silhouettes and reduced-motion sources use still artwork',()=>{
  const view=render(<ButterflyGuide discovered={['monarch']}/>);
  const card=view.getByRole('article',{name:'Monarch'});
  expect(within(card).getByRole('img',{name:'Monarch: caterpillar'})).toHaveAttribute('src',expect.stringContaining('/monarch/caterpillar-crawl.gif'));
  expect(card.querySelector('source')).toHaveAttribute('media','(prefers-reduced-motion: reduce)');
  expect(card.querySelector('source')).toHaveAttribute('srcset',expect.stringContaining('/monarch/caterpillar.webp'));
  expect(view.getAllByAltText('Undiscovered caterpillar silhouette')[0]).toHaveAttribute('src',expect.stringMatching(/caterpillar\.webp$/));
});
