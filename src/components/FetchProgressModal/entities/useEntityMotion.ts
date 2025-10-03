import { useCallback, useEffect, useRef, useState } from "react";
import { clamp, rand } from "./math";
import type { MotionConfig, UseEntityMotionOptions, UseEntityMotionReturn } from "./types";

/**
 * Handles autonomous stepping left/right within viewport bounds, facing flip,
 * and a short “moving” pulse for CSS animations. Works for Bunny, Fox, Wolf, etc.
 */
export function useEntityMotion(
  opts: UseEntityMotionOptions,
  cfg: MotionConfig
): UseEntityMotionReturn {
  const {
    active,
    dead = false,
    initialXvw = rand(10, 90),
    onStep,
  } = opts;

  const {
    stepMinVw,
    stepMaxVw,
    minXvw = 5,
    maxXvw = 95,
    jitterMs = [800, 1800],
    movePulseMs = 600,
  } = cfg;

  const [xvw, setXvw] = useState<number>(() => clamp(initialXvw, minXvw, maxXvw));
  const [facingRight, setFacingRight] = useState<boolean>(true);
  const [moving, setMoving] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);
  const pulseRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const clearPulse = () => {
    if (pulseRef.current) { window.clearTimeout(pulseRef.current); pulseRef.current = null; }
  };

  const doStep = useCallback(() => {
    if (dead) return;

    // pick a random signed step
    const mag = rand(stepMinVw, stepMaxVw);
    const sign = Math.random() < 0.5 ? -1 : 1;
    let next = xvw + sign * mag;

    // bounce if out of bounds
    if (next < minXvw) next = minXvw + (minXvw - next);
    if (next > maxXvw) next = maxXvw - (next - maxXvw);

    setFacingRight(next >= xvw);
    setXvw(next);

    // pulse "moving" for CSS animation
    setMoving(true);
    clearPulse();
    pulseRef.current = window.setTimeout(() => setMoving(false), movePulseMs);

    onStep?.(next);
  }, [dead, xvw, stepMinVw, stepMaxVw, minXvw, maxXvw, movePulseMs, onStep]);

  const scheduleNext = useCallback(() => {
    clearTimer();
    const wait = rand(jitterMs[0], jitterMs[1]);
    timerRef.current = window.setTimeout(() => {
      doStep();
      scheduleNext();
    }, wait);
  }, [doStep, jitterMs]);

  const kickNow = useCallback(() => {
    clearTimer();
    doStep();
    // resume regular cadence
    if (active && !dead) scheduleNext();
  }, [active, dead, doStep, scheduleNext]);

  // start/stop on active/dead changes
  useEffect(() => {
    clearTimer(); clearPulse();
    setMoving(false);
    if (active && !dead) scheduleNext();
    return () => { clearTimer(); clearPulse(); };
  }, [active, dead, scheduleNext]);

  return { xvw, facingRight, moving, kickNow, setXvw };
}
