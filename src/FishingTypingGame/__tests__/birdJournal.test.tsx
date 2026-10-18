import React from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import { deserializeSave, emptySave } from '../engine/storage';
import { blankEntry, deleteNotebookEntry, saveNotebookEntry } from '../engine/notebook';
import { discoverVisitor } from '../engine/visitors';
import FieldGuide, { guideDiscoveries } from '../components/FieldGuide';
import { NotebookEditor } from '../components/CatchNotebook';

declare const test:any,expect:any,jest:any;

test('bird discoveries and illustrated notes persist, reject invalid data and leave fishing rewards alone',()=>{
  const original=emptySave(),pose={direction:'back-right' as const,frame:11};
  let save=discoverVisitor(discoverVisitor(original,'cardinal'),'cardinal');
  save=discoverVisitor(save,'sparrow');
  expect(save.visitorDiscoveries).toEqual(['cardinal','sparrow']);
  expect(save.balance).toBe(original.balance);expect(save.stats).toBe(original.stats);expect(save.livewell).toBe(original.livewell);
  expect(save.notebook).toEqual([]);
  const entry=blankEntry('bird-1',new Date().toISOString(),'cove',{kind:'bird',speciesId:'cardinal',pose});
  save=saveNotebookEntry(save,entry.id,{title:'At the willow',notes:'Red wings'},entry);
  const loaded=deserializeSave(JSON.stringify(save));
  expect(loaded.notebook![0]).toEqual({...entry,title:'At the willow',notes:'Red wings'});
  expect(deserializeSave(JSON.stringify(deleteNotebookEntry(loaded,entry.id))).visitorDiscoveries).toEqual(['cardinal','sparrow']);
  const malformed=deserializeSave(JSON.stringify({...save,visitorDiscoveries:['cardinal','cardinal','fake'],notebook:[{...entry,image:{kind:'bird',speciesId:'cardinal',pose:{direction:'bad',frame:999}}},{...entry,id:'bad-species',image:{kind:'bird',speciesId:'fake'}}]}));
  expect(malformed.visitorDiscoveries).toEqual(['cardinal']);
  expect(malformed.notebook![0].image).toEqual({kind:'bird',speciesId:'cardinal'});
  expect(malformed.notebook![1].image).toBeUndefined();
});

test('the Birds field guide reveals only discovered birds and notebook pages retain their observed view',()=>{
  const save=discoverVisitor(emptySave(),'cardinal'),discoveries=guideDiscoveries(save);
  const guide=render(<FieldGuide discoveries={discoveries} initialTab="birds"/>);
  expect(guide.getByRole('tab',{name:'Birds · 1/2'})).toHaveAttribute('aria-selected','true');
  expect(guide.getByRole('heading',{name:'Cardinal'})).toBeInTheDocument();
  expect(guide.queryByRole('heading',{name:'Sparrow'})).toBeNull();
  expect(guide.getByRole('img',{name:'Undiscovered bird silhouette'})).toBeInTheDocument();guide.unmount();
  const entry=blankEntry('bird-1',new Date().toISOString(),'cove',{kind:'bird',speciesId:'cardinal',pose:{direction:'front-left',frame:5}});
  const view=render(<NotebookEditor entry={entry} units="metric" onSave={jest.fn()} discoveries={discoveries}/>);
  const illustration=view.getByRole('img',{name:'The bird you observed'});
  expect(illustration).toHaveAttribute('data-bird-direction','front-left');expect(illustration).toHaveAttribute('data-bird-frame','5');
  expect(illustration.style.backgroundImage).toContain('cardinal/flight-sheet.webp');
  fireEvent.click(view.getByRole('button',{name:'Open field guide'}));
  expect(within(view.getByRole('dialog')).getByRole('tab',{name:'Birds · 1/2'})).toHaveAttribute('aria-selected','true');
});
