// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any, jest: any;
import { createFrameQueue } from "./frameQueue";

test("many input events produce one update with the latest position", () => {
  const apply = jest.fn(), cancel = jest.fn();
  let paint: FrameRequestCallback = () => {};
  const request = jest.fn((callback: FrameRequestCallback) => { paint = callback; return 1; });
  const queue = createFrameQueue(apply, request, cancel);
  for (let i = 0; i < 100; i++) queue.schedule(i);
  expect(request).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
  paint(16);
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(99);
  queue.schedule(123);
  queue.flush();
  expect(cancel).toHaveBeenCalledWith(1);
  expect(apply).toHaveBeenLastCalledWith(123);
  paint(32);
  expect(apply).toHaveBeenCalledTimes(2);
});

test("cleanup discards a pending update", () => {
  const apply = jest.fn(), cancel = jest.fn();
  let paint: FrameRequestCallback = () => {};
  const queue = createFrameQueue(apply, callback => { paint = callback; return 7; }, cancel);
  queue.schedule(1); queue.cancel(); paint(16);
  expect(cancel).toHaveBeenCalledWith(7);
  expect(apply).not.toHaveBeenCalled();
});

test("wheel deltas accumulate without losing events between frames", () => {
  const apply = jest.fn();
  let paint: FrameRequestCallback = () => {};
  const request = jest.fn((callback: FrameRequestCallback) => { paint = callback; return 1; });
  const queue = createFrameQueue<number>(apply, request, jest.fn(), (previous, next) => previous + next);
  for (let i = 0; i < 20; i++) queue.schedule(5);
  paint(16);
  expect(request).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(100);
});
