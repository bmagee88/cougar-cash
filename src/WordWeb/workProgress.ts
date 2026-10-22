import { useEffect, useState } from "react";

/** Add large drawing updates in batches so input, paint, and timers can run. */
export function useDrawingProgress(nodes: number, edges: number, _revision: unknown) {
  const large = nodes + edges > 500;
  // Retain the completed drawing budget across camera/selection changes instead
  // of removing already-painted elements and drawing them all over again.
  const [progress, setProgress] = useState({ nodes: 100, edges: 250 });
  const drawnNodes = large ? Math.min(nodes, progress.nodes) : nodes;
  const drawnEdges = large ? Math.min(edges, progress.edges) : edges;
  const drawing = drawnNodes < nodes || drawnEdges < edges;
  useEffect(() => {
    if (!large || !drawing) return;
    const timer = setTimeout(() => setProgress({ nodes: drawnNodes + 100, edges: drawnEdges + 250 }), 16);
    return () => clearTimeout(timer);
  }, [large, drawing, drawnNodes, drawnEdges]);
  return { drawnNodes, drawnEdges, drawing };
}

export function useDelayedWorking(working: boolean) {
  const [status, setStatus] = useState({ working, visible: false });
  if (status.working !== working) setStatus({ working, visible: false });
  useEffect(() => {
    if (!working) return;
    const timer = setTimeout(() => setStatus({ working: true, visible: true }), 2000);
    return () => clearTimeout(timer);
  }, [working]);
  return working && status.working && status.visible;
}
