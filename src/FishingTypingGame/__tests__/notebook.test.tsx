import React, { useState } from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import { BALANCE, SPECIES } from '../engine/config';
import { generateEncounter, seededRandom } from '../engine/encounters';
import { awardCatch, deserializeSave, emptySave, releaseFish } from '../engine/storage';
import { addNotebookEntry, notebookEntries, saveNotebookEntry } from '../engine/notebook';
import { CM_PER_IN, fishDisplaySize, formatLength, formatWeight, KG_PER_LB, qualityForWeight, qualityWeightRange } from '../engine/specimens';
import { QUALITIES } from '../engine/types';
import CatchNotebook, { NotebookEditor } from '../components/CatchNotebook';
import FishInspection from '../components/FishInspection';
import FishArtwork from '../components/FishArtwork';
import { Livewell } from '../components/CollectionPanels';

declare const test:any,expect:any,jest:any;
const performance={wpm:40,accuracy:100,timeRemaining:2,correctCharacters:25};

test('species weight bands never overlap and every generated quality matches its weight',()=>{
  SPECIES.forEach(species=>{
    const random=seededRandom(917);
    QUALITIES.forEach((quality,index)=>{
      const [low,high]=qualityWeightRange(species,quality);
      expect(qualityForWeight(species,low)).toBe(quality);expect(qualityForWeight(species,high)).toBe(quality);
      if(index)expect(low).toBeGreaterThan(qualityWeightRange(species,QUALITIES[index-1])[1]);
      for(let i=0;i<60;i++){
        const fish=generateEncounter(random,{speciesId:species.id,quality});
        expect(fish.quality).toBe(qualityForWeight(species,fish.weightKg));expect(fish.quality).toBe(quality);
        expect(fish.weightKg).toBeGreaterThanOrEqual(low);expect(fish.weightKg).toBeLessThanOrEqual(high);
        expect(fish.lengthCm).toBeGreaterThanOrEqual(species.lengthCm[0]);expect(fish.lengthCm).toBeLessThanOrEqual(species.lengthCm[1]);
      }
    });
  });
});
test('length stretches the fish horizontally while greater mass increases both dimensions',()=>{
  const species=SPECIES[3],small=fishDisplaySize(species,30,1),long=fishDisplaySize(species,60,1),heavy=fishDisplaySize(species,30,4);
  expect(long.width).toBeGreaterThan(small.width);expect(long.thickness).toBe(small.thickness);
  expect(heavy.width).toBeGreaterThan(small.width);expect(heavy.thickness).toBeGreaterThan(small.thickness);
});
test('ruler marks use real units and remain calibrated to a large fish after scaling',()=>{
  const fish={...generateEncounter(seededRandom(55),{speciesId:'sturgeon',quality:'SS'}),lengthCm:170};
  const view=render(<FishArtwork fish={fish} ruler units="imperial"/>);
  const check=(centimetersPerUnit:number)=>{
    const width=Number(view.container.querySelector('svg > svg')!.getAttribute('width'));
    const position=(value:number)=>Number(view.container.querySelector(`[data-ruler-tick="${value}"] path`)!.getAttribute('d')!.match(/^M([\d.]+)/)![1]);
    expect((position(1)-position(0))*fish.lengthCm/centimetersPerUnit).toBeCloseTo(width,5);
  };
  check(CM_PER_IN);view.rerender(<FishArtwork fish={fish} ruler units="metric"/>);check(1);
});
test('legacy held fish are reclassified by weight once without losing measurements, coins or catch totals',()=>{
  const fish=generateEncounter(seededRandom(11),{speciesId:'bass',quality:'SS'}),save=awardCatch(emptySave(),fish,performance);
  save.livewell[0]={...save.livewell[0],quality:'C'};save.stats.byQuality={C:1,B:0,A:0,S:0,SS:0};delete save.sizeQualityVersion;
  const loaded=deserializeSave(JSON.stringify(save));
  expect(loaded.livewell[0].quality).toBe('SS');expect(loaded.livewell[0].weightKg).toBe(fish.weightKg);expect(loaded.stats.byQuality).toMatchObject({C:0,SS:1});
  expect(loaded.balance).toBe(save.balance);expect(loaded.stats.caught).toBe(1);expect(deserializeSave(JSON.stringify(loaded))).toEqual(loaded);
});
test('new and legacy preferences default to hidden details and imperial while explicit choices survive',()=>{
  const save=emptySave();expect(save.settings).toMatchObject({hideFishDetails:true,measurements:'imperial'});
  delete save.settings.hideFishDetails;delete save.settings.measurements;
  expect(deserializeSave(JSON.stringify(save)).settings).toMatchObject({hideFishDetails:true,measurements:'imperial'});
  save.settings.hideFishDetails=false;save.settings.measurements='metric';
  expect(deserializeSave(JSON.stringify(save)).settings).toMatchObject({hideFishDetails:false,measurements:'metric'});
  expect(formatLength(12*CM_PER_IN,'imperial')).toBe('12.00 in');expect(formatWeight(2*KG_PER_LB,'imperial')).toBe('2.00 lb');
});
test('catch notes start blank, persist independently of actual stats and remain after release',()=>{
  const fish=generateEncounter(seededRandom(14));let save=awardCatch(emptySave(),fish,performance);
  const note=notebookEntries(save)[0];expect(note.name).toBe('');expect(note.weightKg).toBeUndefined();expect(note.lengthCm).toBeUndefined();
  save=saveNotebookEntry(save,fish.id,{name:'My guess',weightKg:KG_PER_LB,lengthCm:10*CM_PER_IN,notes:'Near the reeds'});
  expect(save.livewell[0].weightKg).toBe(fish.weightKg);expect(save.livewell[0].quality).toBe(fish.quality);
  const released=deserializeSave(JSON.stringify(releaseFish(save,fish.id)));
  expect(released.livewell).toHaveLength(0);expect(released.notebook![0]).toMatchObject({name:'My guess',weightKg:KG_PER_LB,lengthCm:25.4,notes:'Near the reeds'});
  expect(released.stats).toEqual(save.stats);expect(released.balance).toBe(BALANCE.initialBalance+BALANCE.catchCoins);
  const legacy={...save,notebook:undefined};expect(deserializeSave(JSON.stringify(legacy)).notebook![0].weightKg).toBeUndefined();
  const malformed={...save,notebook:[{...note,weightKg:-1,lengthCm:'12',notes:4},note]};
  const loaded=deserializeSave(JSON.stringify(malformed));expect(loaded.notebook).toHaveLength(1);expect(loaded.notebook![0].weightKg).toBeUndefined();expect(loaded.livewell).toHaveLength(1);
});
test('weighing reveals the scale reading without recording it and manual imperial fields save canonical values',()=>{
  const fish={...generateEncounter(seededRandom(20)),weightKg:2*KG_PER_LB,lengthCm:12*CM_PER_IN};
  let latest=awardCatch(emptySave(),fish,performance);
  function Harness(){const [save,setSave]=useState(latest);return <><FishInspection fish={fish} units="imperial"/><NotebookEditor entry={notebookEntries(save)[0]} units="imperial" onSave={(id,patch)=>{latest=saveNotebookEntry(save,id,patch);setSave(latest);}}/></>;}
  const view=render(<Harness/>);
  expect(view.getByRole('img',{name:/ruler in inches/})).toBeInTheDocument();
  expect(view.getByPlaceholderText('Unweighed')).toHaveValue(null);
  fireEvent.click(view.getByRole('button',{name:'Weigh fish'}));
  expect(within(view.getByRole('dialog')).getByRole('status')).toHaveTextContent('2.00 lb');
  expect(latest.notebook![0].weightKg).toBeUndefined();
  fireEvent.click(view.getByRole('button',{name:'Close fishing scale'}));
  const weight=view.getByLabelText('Weight (lb)'),length=view.getByLabelText('Length (in)');
  fireEvent.change(weight,{target:{value:'2'}});fireEvent.blur(weight);
  fireEvent.change(length,{target:{value:'12'}});fireEvent.blur(length);
  expect(latest.notebook![0].weightKg).toBe(2*KG_PER_LB);expect(latest.notebook![0].lengthCm).toBe(12*CM_PER_IN);
  fireEvent.change(weight,{target:{value:'-4'}});fireEvent.blur(weight);expect(view.getByText('Use a positive number.')).toBeInTheDocument();expect(latest.notebook![0].weightKg).toBe(2*KG_PER_LB);
  fireEvent.change(weight,{target:{value:''}});fireEvent.blur(weight);expect(latest.notebook![0].weightKg).toBeUndefined();
  view.unmount();
});
test('unit changes and untouched rounded inputs do not change recorded measurements',()=>{
  const fish=generateEncounter(seededRandom(20)),save=saveNotebookEntry(awardCatch(emptySave(),fish,performance),fish.id,{weightKg:1,lengthCm:33.333});
  const onSave=jest.fn(),entry=save.notebook![0];
  const view=render(<NotebookEditor entry={entry} units="imperial" onSave={onSave}/>);
  fireEvent.blur(view.getByLabelText('Weight (lb)'));fireEvent.blur(view.getByLabelText('Length (in)'));expect(onSave).not.toHaveBeenCalled();
  view.rerender(<NotebookEditor entry={entry} units="metric" onSave={onSave}/>);
  expect(view.getByLabelText('Weight (kg)')).toHaveValue(1);fireEvent.blur(view.getByLabelText('Length (cm)'));expect(onSave).not.toHaveBeenCalled();
});
test('hidden livewell details avoid names and qualities and page turns preserve handwritten entries',()=>{
  const fish=generateEncounter(seededRandom(3),{speciesId:'bass'}),save=awardCatch(emptySave(),fish,performance),noop=()=>{};
  const view=render(<Livewell save={save} onRelease={noop} onReleaseMany={noop} onSaveNote={noop}/>);
  expect(view.queryByRole('heading',{name:'Largemouth bass'})).not.toBeInTheDocument();expect(view.queryByText(/^Quality /)).not.toBeInTheDocument();
  fireEvent.click(view.getByRole('button',{name:/Catch 1/}));expect(view.getByRole('button',{name:'Weigh fish'})).toBeInTheDocument();expect(view.getByPlaceholderText('Unmeasured')).toBeInTheDocument();
  view.unmount();let journal=save;for(let i=0;i<2;i++)journal=addNotebookEntry(journal);
  const entries=notebookEntries(journal),onSave=jest.fn();entries[0].name='First fish';entries[2].name='Third fish';
  const book=render(<CatchNotebook entries={entries} units="imperial" onSave={onSave} onAdd={noop}/>);
  expect(book.getByDisplayValue('First fish')).toBeInTheDocument();fireEvent.click(book.getByRole('button',{name:'Next pages →'}));expect(book.getByDisplayValue('Third fish')).toBeInTheDocument();
  fireEvent.click(book.getByRole('button',{name:'← Previous pages'}));expect(book.getByDisplayValue('First fish')).toBeInTheDocument();
});
