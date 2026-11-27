import React, { useRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import CameraDriftSetting from '../components/CameraDriftSetting';
import { deserializeSave, emptySave } from '../engine/storage';
import { useSceneParallax } from '../scene/useSceneParallax';

declare const test: any, expect: any, jest: any, beforeEach: any, afterEach: any;

let nextFrame: FrameRequestCallback | undefined;
function Scene({ enabled = true, intervalMs = 0, reduced = false }: {
  enabled?: boolean; intervalMs?: number; reduced?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSceneParallax(ref, reduced, intervalMs, enabled);
  return <div ref={ref}><div data-scene-depth="background" /></div>;
}
beforeEach(() => {
  jest.useFakeTimers('modern');
  nextFrame = undefined;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    nextFrame = callback; return 1;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { nextFrame = undefined; });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('turning camera drift off cancels its frame loop, resets positions and can be reversed', () => {
  const view = render(<Scene />), scene = view.container.firstChild as HTMLElement;
  act(() => { nextFrame?.(0); nextFrame?.(100); });
  expect(parseFloat(scene.style.getPropertyValue('--scene-x'))).toBeGreaterThan(0);
  view.rerender(<Scene enabled={false} />);
  expect(nextFrame).toBeUndefined();
  for (const property of ['--scene-x', '--scene-y', '--environment-x']) {
    expect(scene.style.getPropertyValue(property)).toBe('0px');
  }
  const calls = (window.requestAnimationFrame as any).mock.calls.length;
  act(() => jest.advanceTimersByTime(30000));
  expect(window.requestAnimationFrame).toHaveBeenCalledTimes(calls);
  expect(jest.getTimerCount()).toBe(0);
  view.rerender(<Scene />);
  expect(nextFrame).toBeDefined();
  view.unmount();
  expect(nextFrame).toBeUndefined();
});

test('camera drift off keeps ten-second weather samples without starting a frame loop', () => {
  const view = render(<Scene enabled={false} intervalMs={10000} />);
  const scene = view.container.firstChild as HTMLElement, target = scene.firstElementChild!;
  const cloud = { animationName: 'f-cloud-life', currentTime: 0, playbackRate: 1, playState: 'paused',
    effect: { target, getKeyframes: () => [{ opacity: 1 }] } };
  Object.defineProperty(scene, 'getAnimations', { value: () => [cloud] });
  expect(jest.getTimerCount()).toBe(1);
  act(() => jest.advanceTimersByTime(9999));
  expect(cloud.currentTime).toBe(0);
  act(() => jest.advanceTimersByTime(1));
  expect(cloud.currentTime).toBe(10000);
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  expect(scene.style.getPropertyValue('--environment-x')).toBe('0px');
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange'));
  expect(scene).toHaveClass('f-scene-paused');
  expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(30000));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  fireEvent(document, new Event('visibilitychange'));
  act(() => jest.advanceTimersByTime(10000));
  expect(cloud.currentTime).toBe(20000);
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('reduced motion still overrides an enabled camera drift preference', () => {
  const view = render(<Scene reduced intervalMs={10000} />);
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  view.unmount();
});

test('camera drift defaults on for old saves and preserves an explicit off preference', () => {
  const save = emptySave();
  expect(save.settings.cameraDrift).toBe(true);
  delete save.settings.cameraDrift;
  expect(deserializeSave(JSON.stringify(save)).settings.cameraDrift).toBe(true);
  save.settings.cameraDrift = false;
  expect(deserializeSave(JSON.stringify(save)).settings.cameraDrift).toBe(false);
  save.settings.cameraDrift = true;
  expect(deserializeSave(JSON.stringify(save)).settings.cameraDrift).toBe(true);
});

test('the camera drift control exposes its description and supports both choices', () => {
  const onChange = jest.fn(), view = render(<CameraDriftSetting enabled onChange={onChange} />);
  const checkbox = view.getByRole('checkbox', { name: 'Camera drift' });
  expect(checkbox).toBeChecked();
  expect(checkbox).toHaveAccessibleDescription(/keep the camera still on large displays/);
  fireEvent.click(checkbox);
  expect(onChange).toHaveBeenLastCalledWith(false);
  view.rerender(<CameraDriftSetting enabled={false} onChange={onChange} />);
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(onChange).toHaveBeenLastCalledWith(true);
});
