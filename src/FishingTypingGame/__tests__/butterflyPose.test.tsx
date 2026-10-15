import React from 'react';
import { render, within } from '@testing-library/react';
import { blankEntry, saveNotebookEntry } from '../engine/notebook';
import { deserializeSave, emptySave } from '../engine/storage';
import { readButterflyPose } from '../engine/butterflies';
import NotebookIllustration from '../components/NotebookIllustration';
import ButterflyGuide from '../components/ButterflyGuide';

declare const test:any,expect:any;

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
