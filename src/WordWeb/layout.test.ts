// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any;
import { VocabularyGraph, DictionaryEntry } from "./graph";
import { cameraForFocus, projectWeb, worldEdgePath } from "./layout";

const entry = (word: string, definition: string): DictionaryEntry => ({ word, meanings: [{ partOfSpeech: "noun", definition }], synonyms: [], antonyms: [], phonetic: "", sourceName: "test", sourceUrl: "https://example.com" });

function makeGraph() {
  const graph = new VocabularyGraph(entry("root", "A first and second word."));
  graph.explore(entry("first", "A second word."), "definition");
  graph.explore(entry("second", "Another root."), "definition");
  return graph;
}

test("every focused word lands at the center on desktop and mobile without rearranging the web", () => {
  const web = makeGraph().snapshot();
  for (const viewport of [{ width: 1280, height: 546 }, { width: 390, height: 676 }]) {
    for (const zoom of [0.15, 0.85, 1.5]) {
      for (const focus of web.nodes.map(node => node.id)) {
        const positions = projectWeb({ ...web, focus }, viewport, zoom);
        expect(positions.get(focus)).toEqual({ x: viewport.width / 2, y: viewport.height / 2 });
        web.nodes.forEach(from => web.nodes.forEach(to => {
          expect(positions.get(to.id)!.x - positions.get(from.id)!.x).toBeCloseTo((to.x - from.x) * zoom, 8);
          expect(positions.get(to.id)!.y - positions.get(from.id)!.y).toBeCloseTo((to.y - from.y) * zoom, 8);
        }));
      }
    }
  }
});

test("changing focus translates every word by exactly the same vector", () => {
  const web = makeGraph().snapshot();
  const viewport = { width: 1280, height: 546 };
  const before = projectWeb({ ...web, focus: "root" }, viewport, 0.85);
  const after = projectWeb({ ...web, focus: "second" }, viewport, 0.85);
  const shift = { x: after.get("root")!.x - before.get("root")!.x, y: after.get("root")!.y - before.get("root")!.y };
  web.nodes.forEach(node => {
    expect(after.get(node.id)!.x - before.get(node.id)!.x).toBeCloseTo(shift.x, 8);
    expect(after.get(node.id)!.y - before.get(node.id)!.y).toBeCloseTo(shift.y, 8);
  });
});

test("offscreen words retain their actual world positions instead of being clamped or rotated", () => {
  const web = makeGraph().snapshot();
  const viewport = { width: 390, height: 676 };
  const positions = projectWeb({ ...web, focus: "second" }, viewport, 1.5);
  expect(Array.from(positions.values()).some(point => point.x < 0 || point.x > viewport.width || point.y < 0 || point.y > viewport.height)).toBe(true);
  const focus = web.nodes.find(node => node.id === "second")!;
  web.nodes.forEach(node => {
    expect(positions.get(node.id)!.x).toBeCloseTo(195 + (node.x - focus.x) * 1.5, 8);
    expect(positions.get(node.id)!.y).toBeCloseTo(338 + (node.y - focus.y) * 1.5, 8);
  });
});

test("resizing changes only the camera offset and zoom scales both axes uniformly", () => {
  const web = makeGraph().snapshot();
  const desktop = cameraForFocus(web, { width: 1280, height: 546 }, 0.85);
  const mobile = cameraForFocus(web, { width: 390, height: 676 }, 0.85);
  expect(mobile.x - desktop.x).toBeCloseTo((390 - 1280) / 2, 8);
  expect(mobile.y - desktop.y).toBeCloseTo((676 - 546) / 2, 8);
  const viewport = { width: 1280, height: 546 };
  const normal = projectWeb(web, viewport, 0.5);
  const doubled = projectWeb(web, viewport, 1);
  web.nodes.forEach(node => {
    expect(doubled.get(node.id)!.x - 640).toBeCloseTo((normal.get(node.id)!.x - 640) * 2, 8);
    expect(doubled.get(node.id)!.y - 273).toBeCloseTo((normal.get(node.id)!.y - 273) * 2, 8);
  });
});

test("discovery and traversal preserve existing node coordinates and every edge curve", () => {
  const graph = makeGraph();
  const before = graph.snapshot();
  const paths = before.edges.map(edge => worldEdgePath(edge, before.nodes.find(node => node.id === edge.from)!, before.nodes.find(node => node.id === edge.to)!));
  graph.backtrack(); graph.backtrack();
  const after = graph.explore(entry("word", "A root."), "definition");
  before.nodes.forEach(node => {
    expect(after.nodes.find(candidate => candidate.id === node.id)).toEqual(node);
  });
  expect(before.edges.map(edge => worldEdgePath(edge, after.nodes.find(node => node.id === edge.from)!, after.nodes.find(node => node.id === edge.to)!))).toEqual(paths);
});

test("antonyms use a smooth curve between the exact endpoints in any direction", () => {
  const edge = { id: "opposites", from: "a", to: "b", kind: "antonym" as const, traversed: false };
  for (const to of [{ x: 300, y: 0 }, { x: 0, y: 300 }, { x: -210, y: -210 }, { x: 1, y: 1 }]) {
    const from = { x: 0, y: 0 };
    const path = worldEdgePath(edge, from, to);
    expect(path.startsWith("M 0 0 Q ")).toBe(true);
    expect(path.endsWith(` ${to.x} ${to.y}`)).toBe(true);
    expect(path).not.toMatch(/L|NaN|Infinity/);
    expect(worldEdgePath({ ...edge, traversed: true }, from, to)).toBe(path);
  }
  const from = { x: 12, y: 15 }, to = { x: 320, y: 405 };
  expect(worldEdgePath({ ...edge, kind: "synonym" }, from, to)).toContain(" Q ");
  expect(worldEdgePath({ ...edge, kind: "definition" }, from, to)).toContain(" Q ");
});

test("manual panning preserves the web geometry and keeps its map center fixed while zooming", () => {
  const web = makeGraph().snapshot(), viewport = { width: 900, height: 640 }, pan = { x: 380, y: -215 };
  const original = JSON.stringify(web);
  let mapCenter: number[] | undefined;
  for (const zoom of [0.15, 0.85, 1.5]) {
    const centered = projectWeb(web, viewport, zoom), panned = projectWeb(web, viewport, zoom, pan);
    web.nodes.forEach(node => {
      expect(panned.get(node.id)!.x - centered.get(node.id)!.x).toBeCloseTo(pan.x * zoom);
      expect(panned.get(node.id)!.y - centered.get(node.id)!.y).toBeCloseTo(pan.y * zoom);
    });
    const camera = cameraForFocus(web, viewport, zoom, pan);
    const center = [(viewport.width / 2 - camera.x) / zoom, (viewport.height / 2 - camera.y) / zoom];
    if (mapCenter) { expect(center[0]).toBeCloseTo(mapCenter[0]); expect(center[1]).toBeCloseTo(mapCenter[1]); }
    mapCenter = center;
  }
  expect(JSON.stringify(web)).toBe(original);
});
