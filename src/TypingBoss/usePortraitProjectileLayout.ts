import React, { useLayoutEffect, useState } from "react";

type Point = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };
type Layout = { positions: Map<string, Point>; bossPoint: Point };

export function portraitProjectileLayout(root: Rect, scene: Rect, profile: Rect, positions: Map<string, Point>, boss: Point, ownCode: string, dragon?: Rect): Layout {
  const convert = (point: Point) => ({
    x: (scene.left - root.left + scene.width * point.x / 100) / root.width * 100,
    y: (scene.top - root.top + scene.height * point.y / 100) / root.height * 100,
  });
  const mapped = new Map(Array.from(positions, ([code, point]) => [code, convert(point)]));
  mapped.set(ownCode, {
    x: (profile.left - root.left + profile.width / 2) / root.width * 100,
    y: (profile.top - root.top + profile.height * .52) / root.height * 100,
  });
  return { positions: mapped, bossPoint: dragon ? {
    x: (dragon.left - root.left + dragon.width / 2) / root.width * 100,
    y: (dragon.top - root.top + dragon.height * .52) / root.height * 100,
  } : convert(boss) };
}

export function usePortraitProjectileLayout(rootRef: React.RefObject<HTMLDivElement | null>, sceneRef: React.RefObject<HTMLDivElement | null>, profileRef: React.RefObject<HTMLDivElement | null>, positions: Map<string, Point>, boss: Point, ownCode: string, dragonRef?: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<Layout | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current, scene = sceneRef.current, profile = profileRef.current;
    if (!root || !scene || !profile) return;
    let frame = 0;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const next = portraitProjectileLayout(bounds, scene.getBoundingClientRect(), profile.getBoundingClientRect(), positions, boss, ownCode, dragonRef?.current?.getBoundingClientRect());
      setLayout(previous => previous && previous.bossPoint.x === next.bossPoint.x && previous.bossPoint.y === next.bossPoint.y &&
        previous.positions.size === next.positions.size && Array.from(next.positions).every(([code, point]) => previous.positions.get(code)?.x === point.x && previous.positions.get(code)?.y === point.y) ? previous : next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    [root, scene, profile, dragonRef?.current].forEach(node => node && observer?.observe(node));
    window.addEventListener("resize", schedule);
    root.addEventListener("scroll", schedule, true);
    return () => {
      observer?.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      root.removeEventListener("scroll", schedule, true);
    };
  }, [rootRef, sceneRef, profileRef, positions, boss, ownCode, dragonRef]);
  return layout;
}
