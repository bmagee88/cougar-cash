// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any, jest: any;
import { act, renderHook } from "@testing-library/react";
import { useDelayedWorking, useDrawingProgress } from "./workProgress";

test("work indicator waits two seconds and clears on completion without leaking timers", () => {
  jest.useFakeTimers();
  try {
    const { result, rerender, unmount } = renderHook(({ working }) => useDelayedWorking(working), { initialProps: { working: true } });
    act(() => { jest.advanceTimersByTime(1999); }); expect(result.current).toBe(false);
    act(() => { jest.advanceTimersByTime(1); }); expect(result.current).toBe(true);
    rerender({ working: false }); expect(result.current).toBe(false);
    rerender({ working: true });
    act(() => { jest.advanceTimersByTime(1000); }); expect(result.current).toBe(false);
    rerender({ working: false });
    act(() => { jest.advanceTimersByTime(3000); }); expect(result.current).toBe(false);
    unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test("large drawings progress across turns and a changed view cancels the old drawing", () => {
  jest.useFakeTimers();
  try {
    const revision = {};
    const { result, rerender, unmount } = renderHook(({ nodes, edges, revision }) => useDrawingProgress(nodes, edges, revision), { initialProps: { nodes: 1200, edges: 4000, revision } });
    expect(result.current.drawing).toBe(true);
    expect(result.current.drawnNodes).toBeLessThan(1200);
    const start = result.current.drawnNodes;
    act(() => { jest.advanceTimersByTime(16); }); expect(result.current.drawnNodes).toBeGreaterThan(start);
    for (let i = 0; i < 20 && result.current.drawing; i++) act(() => { jest.advanceTimersByTime(16); });
    expect(result.current).toMatchObject({ drawnNodes: 1200, drawnEdges: 4000, drawing: false });
    // A camera/selection revision must not remove a completed large drawing.
    rerender({ nodes: 1200, edges: 4000, revision: {} });
    expect(result.current).toMatchObject({ drawnNodes: 1200, drawnEdges: 4000, drawing: false });
    expect(jest.getTimerCount()).toBe(0);
    rerender({ nodes: 2000, edges: 8000, revision: {} }); expect(result.current.drawing).toBe(true);
    expect(result.current.drawnNodes).toBeGreaterThanOrEqual(1200);
    expect(result.current.drawnEdges).toBeGreaterThanOrEqual(4000);
    rerender({ nodes: 10, edges: 8, revision: {} }); expect(result.current).toMatchObject({ drawnNodes: 10, drawnEdges: 8, drawing: false });
    unmount(); expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test("continuous camera changes do not postpone drawing batches", () => {
  jest.useFakeTimers();
  try {
    const { result, rerender, unmount } = renderHook(({ revision }) => useDrawingProgress(1200, 4000, revision), { initialProps: { revision: {} } });
    for (let i = 0; i < 10; i++) {
      act(() => { jest.advanceTimersByTime(8); });
      rerender({ revision: {} });
    }
    expect(result.current.drawnNodes).toBeGreaterThan(100);
    expect(result.current.drawnEdges).toBeGreaterThan(250);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
