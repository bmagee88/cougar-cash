import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { ScreenLock, useScreenWakeLock } from '../useScreenWakeLock';
import ScreenAwakeSetting from '../components/ScreenAwakeSetting';
import { deserializeSave, emptySave } from '../engine/storage';

declare const test:any,expect:any,jest:any,beforeEach:any,afterEach:any;
const originalApi=Object.getOwnPropertyDescriptor(navigator,'wakeLock');
const originalSecure=Object.getOwnPropertyDescriptor(window,'isSecureContext');
const originalHidden=Object.getOwnPropertyDescriptor(document,'hidden');
let request:any;
function lock() {
  const value=new EventTarget() as ScreenLock;
  Object.defineProperty(value,'released',{configurable:true,value:false});
  value.release=jest.fn(async()=>{
    Object.defineProperty(value,'released',{configurable:true,value:true});
    value.dispatchEvent(new Event('release'));
  });
  return value;
}
function visibility(hidden:boolean) {
  Object.defineProperty(document,'hidden',{configurable:true,value:hidden});
  fireEvent(document,new Event('visibilitychange'));
}
beforeEach(()=>{
  request=jest.fn();
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request}});
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
});
afterEach(()=>{
  for(const [target,key,descriptor] of [[navigator,'wakeLock',originalApi],[window,'isSecureContext',originalSecure],[document,'hidden',originalHidden]] as const){
    if(descriptor) Object.defineProperty(target,key,descriptor); else delete target[key];
  }
  jest.restoreAllMocks();
});

test('screen wake lock is opt-in and releases when disabled',async()=>{
  const held=lock(); request.mockResolvedValue(held);
  const hook=renderHook(({enabled})=>useScreenWakeLock(enabled),{initialProps:{enabled:false}});
  expect(request).not.toHaveBeenCalled(); expect(hook.result.current.status).toBe('off');
  await act(async()=>hook.rerender({enabled:true}));
  expect(request).toHaveBeenCalledWith('screen'); expect(hook.result.current.status).toBe('active');
  hook.rerender({enabled:false}); expect(held.release).toHaveBeenCalledTimes(1); expect(hook.result.current.status).toBe('off');
  hook.unmount(); expect(held.release).toHaveBeenCalledTimes(1);
});

test('hiding releases the lock and returning acquires a fresh sentinel',async()=>{
  const first=lock(),second=lock(); request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  const hook=renderHook(()=>useScreenWakeLock(true));
  await act(async()=>{}); expect(hook.result.current.status).toBe('active');
  visibility(true); expect(first.release).toHaveBeenCalledTimes(1); expect(hook.result.current.status).toBe('paused');
  await act(async()=>visibility(false)); expect(request).toHaveBeenCalledTimes(2); expect(hook.result.current.status).toBe('active');
  hook.unmount(); expect(second.release).toHaveBeenCalledTimes(1);
});

test('initially hidden pages wait until visible to request a lock',async()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  request.mockResolvedValue(lock()); const hook=renderHook(()=>useScreenWakeLock(true));
  expect(request).not.toHaveBeenCalled(); expect(hook.result.current.status).toBe('paused');
  await act(async()=>visibility(false)); expect(hook.result.current.status).toBe('active'); hook.unmount();
});

test('a request finishing after disabling or unmounting is released immediately',async()=>{
  for(const unmount of [false,true]){
    let resolve:(held:ScreenLock)=>void;
    request.mockImplementationOnce(()=>new Promise<ScreenLock>(done=>{resolve=done;}));
    const hook=renderHook(({enabled})=>useScreenWakeLock(enabled),{initialProps:{enabled:true}});
    if(unmount) hook.unmount(); else hook.rerender({enabled:false});
    const late=lock(); await act(async()=>resolve(late));
    expect(late.release).toHaveBeenCalledTimes(1);
    if(!unmount){expect(hook.result.current.status).toBe('off');hook.unmount();}
  }
});

test('a hide-return cycle during a pending request discards the stale grant and reacquires',async()=>{
  let resolve:(held:ScreenLock)=>void;
  const stale=lock(),current=lock();
  request.mockImplementationOnce(()=>new Promise<ScreenLock>(done=>{resolve=done;})).mockResolvedValueOnce(current);
  const hook=renderHook(()=>useScreenWakeLock(true));
  visibility(true); visibility(false); expect(request).toHaveBeenCalledTimes(1);
  await act(async()=>resolve(stale));
  expect(stale.release).toHaveBeenCalledTimes(1); expect(request).toHaveBeenCalledTimes(2); expect(hook.result.current.status).toBe('active');
  hook.unmount(); expect(current.release).toHaveBeenCalledTimes(1);
});

test('denial and system release show a retry state without a retry loop',async()=>{
  request.mockRejectedValueOnce(new Error('Low battery'));
  const held=lock(); request.mockResolvedValueOnce(held);
  const hook=renderHook(()=>useScreenWakeLock(true)); await act(async()=>{});
  expect(hook.result.current.status).toBe('blocked'); expect(request).toHaveBeenCalledTimes(1);
  await act(async()=>hook.result.current.retry()); expect(hook.result.current.status).toBe('active');
  await act(async()=>held.release()); expect(hook.result.current.status).toBe('blocked'); expect(request).toHaveBeenCalledTimes(2);
  hook.unmount();
});

test('unsupported browsers and insecure pages never request a lock',()=>{
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});
  let hook=renderHook(()=>useScreenWakeLock(true)); expect(hook.result.current.status).toBe('unsupported'); hook.unmount();
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:undefined});
  hook=renderHook(()=>useScreenWakeLock(true)); expect(hook.result.current.supported).toBe(false); expect(hook.result.current.status).toBe('unsupported');
  expect(request).not.toHaveBeenCalled(); hook.unmount();
});

test('the saved preference migrates safely and the setting exposes useful status and retry controls',()=>{
  const save=emptySave(); expect(save.settings.keepScreenAwake).toBe(true);
  for(const [value,expected] of [[true,true],[false,false],['true',true],[undefined,true]] as const){
    expect(deserializeSave(JSON.stringify({...save,settings:{...save.settings,keepScreenAwake:value}})).settings.keepScreenAwake).toBe(expected);
  }
  const change=jest.fn(),retry=jest.fn();
  const view=render(<ScreenAwakeSetting enabled supported status="blocked" onChange={change} retry={retry}/>);
  fireEvent.click(view.getByRole('button',{name:'Try keeping screen awake again'})); expect(retry).toHaveBeenCalledTimes(1);
  fireEvent.click(view.getByRole('checkbox',{name:'Keep screen awake'})); expect(change).toHaveBeenCalledWith(false);
  view.rerender(<ScreenAwakeSetting enabled={false} supported={false} status="unsupported" onChange={change} retry={retry}/>);
  expect(view.getByRole('checkbox')).toBeDisabled(); expect(view.getByRole('status')).toHaveTextContent(/HTTPS/);
});
