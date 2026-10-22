// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any;
import type { WordNode, WordEdge } from "./graph";
import { buildDrawingFrame, buildRenderScene } from "./renderScene";

const node = (id: string, x: number, y = 0): WordNode => ({ id, x, y, parent: null, entry: { word: id, phonetic: "", meanings: [{ partOfSpeech: "noun", definition: "A concept." }], synonyms: [], antonyms: [], sourceName: "test", sourceUrl: "https://example.com" } });
const edge = (from: string, to: string, traversed = false): WordEdge => ({ id: JSON.stringify([from, to, "definition"]), from, to, kind: "definition", traversed });
const view = { width: 400, height: 300 };
const scene = (nodes: WordNode[], edges: WordEdge[], zoom = 1, trail = new Set<string>(), trailEdges = new Set<string>(), important = new Set<string>()) =>
  buildRenderScene(nodes, edges, { x: 200, y: 150, zoom }, view, new Map(), trail, trailEdges, important);

test("drawing batches wait for visible endpoints but retain connections crossing from offscreen", () => {
  const nodes = [node("a", 0), node("b", 50), node("offscreen", -3000)];
  const result = scene(nodes, [edge("a", "b"), edge("offscreen", "a")]);
  const first = buildDrawingFrame(result, 1, 250);
  expect(first.nodes.map(node => node.id)).toEqual(["a"]);
  expect(first.edges.map(edge => edge.from)).toEqual(["offscreen"]);
  expect(buildDrawingFrame(result, 2, 250).edges).toHaveLength(2);
});

test("important words and trail words draw before other labels", () => {
  const result = scene([node("other", 0), node("trail", 50), node("selected", 100), ...Array.from({ length: 500 }, (_, i) => node(`extra${i}`, 0))], [], 1,
    new Set(["trail"]), new Set(), new Set(["selected"]));
  expect(result.nodes.slice(0, 3).map(node => node.id)).toEqual(["selected", "trail", "other"]);
});

test("offscreen words and lines are culled but lines crossing the viewport remain", () => {
  const nodes = [node("near", 0), node("left", -3000), node("right", 3000), node("farther", 3500)];
  const crossing = edge("left", "right"), outside = edge("right", "farther");
  const result = scene(nodes, [crossing, outside]);
  expect(result.nodes.map(node => node.id)).toEqual(["near"]);
  expect(result.edges.map(edge => edge.id)).toEqual([crossing.id]);
  const panned = buildRenderScene(nodes, [], { x: -2800, y: 150, zoom: 1 }, view, new Map(), new Set(), new Set(), new Set());
  expect(panned.nodes.some(node => node.id === "right")).toBe(true);
});

test("label-only view keeps every visible word through selection and long pans with bounded DOM work", () => {
  const nodes = Array.from({ length: 2000 }, (_, i) => node(`word${i}`, i * 100));
  const edges = nodes.slice(1).map((current, i) => edge(nodes[i].id, current.id));
  const important = new Set(nodes.map(node => node.id));
  for (const index of [0, 500, 1000, 1900]) {
    const camera = { x: 200 - nodes[index].x * .43, y: 150, zoom: .43 };
    const result = buildRenderScene(nodes, edges, camera, view, new Map(), new Set(), new Set(), important, 19, nodes[index].id, true);
    expect(result.dots.size).toBe(0);
    expect(result.clusters).toHaveLength(0);
    expect(result.nodes.some(node => node.id === nodes[index].id)).toBe(true);
    expect(result.nodes.length).toBeLessThan(40);
    const frame = buildDrawingFrame(result, result.nodes.length, result.edges.length);
    expect(frame.nodes).toHaveLength(result.nodes.length);
    expect(frame.edges).toHaveLength(result.edges.length);
    for (const current of nodes) {
      const x = camera.x + current.x * camera.zoom;
      if (x >= 0 && x <= view.width) expect(frame.nodes.some(node => node.id === current.id)).toBe(true);
    }
  }
});

test("diagonal edges that miss the viewport are culled despite overlapping bounding boxes", () => {
  const nodes = [node("left", -1200, 150), node("above", 100, -1150)];
  expect(scene(nodes, [edge("left", "above")]).edges).toHaveLength(0);
});

test("tiny neighboring words merge without clustering the active trail", () => {
  const nodes = [node("focus", -300), node("a", 0), node("b", 60)];
  const edges = [edge("focus", "a", true), edge("focus", "b")];
  const original = JSON.stringify({ nodes, edges });
  const result = scene(nodes, edges, .2, new Set(["focus", "a"]), new Set([edges[0].id]), new Set(["focus"]));
  expect(result.clusters).toHaveLength(0);
  expect(result.nodes.map(node => node.id)).toEqual(["focus", "a", "b"]);
  expect(result.edges).toHaveLength(2);
  expect(result.edges[0]).toMatchObject({ traversed: true, onTrail: true });
  expect(result.lowDetail).toBe(true);
  const close = scene(nodes, edges, 1);
  expect(close.clusters).toHaveLength(0); expect(close.dots.size).toBe(0);
  expect(JSON.stringify({ nodes, edges })).toBe(original);
});

test("the entire active trail stays unclustered at minimum zoom beside clustered words", () => {
  const nodes = [node("start", 0), node("middle", 10), node("end", 20), node("other", 25), node("nearby", 30)];
  const edges = [edge("start", "middle", true), edge("middle", "end", true)];
  const result = scene(nodes, edges, .12, new Set(["start", "middle", "end"]), new Set(edges.map(edge => edge.id)));
  expect(result.nodes.map(node => node.id)).toEqual(["start", "middle", "end"]);
  expect(result.clusters.map(cluster => cluster.members)).toEqual([["other", "nearby"]]);
  expect(result.edges.map(edge => [edge.from, edge.to, edge.onTrail])).toEqual([
    ["start", "middle", true], ["middle", "end", true],
  ]);
});

test("clusters grow with membership and handle a dense group without retaining individual dots", () => {
  const small = scene([node("a", 0), node("b", 5)], [], .2);
  const dense = scene(Array.from({ length: 1000 }, (_, i) => node(`word${i}`, i % 10)), [], .2);
  expect(dense.clusters).toHaveLength(1);
  expect(dense.clusters[0].radius).toBeGreaterThan(small.clusters[0].radius);
  expect(dense.nodes).toHaveLength(0);
  expect(dense.clusters[0].members).toHaveLength(1000);
});

test("clusters select their most connected word with stable ties", () => {
  const nodes = [node("first", 0), node("hub", 5), node("tied", 10)];
  const result = buildRenderScene(nodes, [], { x: 200, y: 150, zoom: .12 }, view,
    new Map([["first", 1], ["hub", 8], ["tied", 8]]), new Set(), new Set(), new Set());
  expect(result.clusters).toHaveLength(1);
  expect(result.clusters[0].representative).toBe("hub");
});

test("selected words stay separate and large readable labels do not become dots", () => {
  const nodes = [node("selected", 0), node("a", 3), node("hub", 1000)];
  const result = buildRenderScene(nodes, [], { x: 200, y: 150, zoom: .2 }, view, new Map([["hub", 30]]), new Set(), new Set(), new Set(["selected"]));
  expect(result.dots.has("selected")).toBe(false);
  expect(result.dots.has("hub")).toBe(false);
  expect(result.dots.has("a")).toBe(true);
  expect(result.clusters).toHaveLength(0);
});
