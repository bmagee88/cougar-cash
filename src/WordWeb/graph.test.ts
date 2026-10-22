// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any;
import { DictionaryEntry, VocabularyGraph, WordTrie } from "./graph";

const entry = (word: string, definition: string, synonyms: string[] = [], antonyms: string[] = []): DictionaryEntry => ({
  word, phonetic: "", meanings: [{ partOfSpeech: "noun", definition }], synonyms, antonyms,
  sourceName: "Test dictionary", sourceUrl: "https://example.com",
});

test("responsive connection building matches synchronous results across a large web", async () => {
  const graph = new VocabularyGraph(entry("root", "Target."));
  const base = graph.snapshot();
  const names = Array.from({ length: 249 }, (_, index) => `word${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`);
  base.nodes[0].entry = entry("root", `Target ${names.join(" ")}.`);
  names.forEach(id => {
    base.nodes.push({ id, entry: entry(id, "Target."), parent: "root", x: 0, y: 0 });
    const pair = ["root", id].sort();
    base.edges.push({ id: JSON.stringify([...pair, "definition"]), from: pair[0], to: pair[1], kind: "definition", traversed: false });
  });
  const responsive = VocabularyGraph.restore(base), synchronous = VocabularyGraph.restore(base);
  const expected = synchronous.explore(entry("target", "A root."), "definition", "target", true);
  expect(await responsive.exploreResponsive(entry("target", "A root."), "definition", "target", true)).toEqual(expected);
  expect(expected.edges.filter(edge => edge.from === "target" || edge.to === "target")).toHaveLength(250);
});

test.each(["definition", "synonym", "antonym"] as const)("discovering a %s without following keeps the trail and leaves its links unvisited", kind => {
  const graph = new VocabularyGraph(entry("root", "Alpha.", ["alpha"], ["alpha"]));
  const web = graph.explore(entry("alpha", "A root."), kind, "alpha", true);
  expect(web.focus).toBe("root"); expect(web.walk).toEqual(["root"]); expect(web.trailEdges).toEqual([]);
  expect(web.nodes).toHaveLength(2); expect(web.edges.every(edge => !edge.traversed)).toBe(true);
  expect(VocabularyGraph.restore(web).snapshot()).toEqual(web);
  expect(graph.traverse("alpha", kind).walk).toEqual(["root", "alpha"]);
});

test.each(["definition", "synonym", "antonym"] as const)("deleted words leave saved islands that reconnect through new %s matches", kind => {
  const graph = new VocabularyGraph(entry("root", "Bridge and sprout."));
  graph.explore({ ...entry("bridge", "An island."), forms: ["bridges"] }, "definition");
  const island = { ...entry("island", kind === "definition" ? "A sprout." : "A remote place.", kind === "synonym" ? ["sprout"] : [], kind === "antonym" ? ["sprout"] : []), forms: ["islands"] };
  const before = graph.explore(island, "definition");
  const deleted = graph.deleteWord("bridges");
  expect(deleted.walk).toEqual(["root"]);
  expect(deleted.nodes.map(node => node.id)).toEqual(["root", "island"]);
  expect(deleted.edges).toEqual([]);
  expect(deleted.nodes[1]).toMatchObject({ parent: null, x: before.nodes[2].x, y: before.nodes[2].y });
  expect(graph.getEntry("bridges")).toBeUndefined();
  const restored = VocabularyGraph.restore(JSON.parse(JSON.stringify(deleted)));
  expect(restored.snapshot()).toEqual(deleted);
  const web = restored.explore(entry("sprout", kind === "definition" ? "Islands." : "A new plant.", kind === "synonym" ? ["islands"] : [], kind === "antonym" ? ["islands"] : []), "definition");
  expect(web.edges.find(edge => edge.kind === kind && [edge.from, edge.to].includes("island"))).toMatchObject({ traversed: false });
  expect(web.nodes.some(node => node.id === "bridge")).toBe(false);
  expect(restored.traverse("island", kind).walk).toEqual(["root", "sprout", "island"]);
  expect(() => restored.traverse("sprout")).toThrow("already on your trail");
});

test("deleting the root, focused word, and final word keeps valid trails and saves", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha."));
  graph.explore(entry("alpha", "Beta."), "definition");
  graph.explore(entry("beta", "A leaf."), "definition");
  expect(graph.deleteWord("root").walk).toEqual(["alpha", "beta"]);
  expect(VocabularyGraph.restore(graph.snapshot()).snapshot()).toEqual(graph.snapshot());
  expect(graph.deleteWord("beta").walk).toEqual(["alpha"]);
  const empty = graph.deleteWord("alpha");
  expect(empty).toMatchObject({ nodes: [], edges: [], walk: [], trailEdges: [], root: "", focus: "" });
  expect(VocabularyGraph.restore(empty).snapshot()).toEqual(empty);
});

test("the trie matches whole words and multiword phrases, including punctuation and case", () => {
  const trie = new WordTrie();
  trie.insert("art", "art"); trie.insert("free will", "free will"); trie.insert("well-being", "well-being");
  expect(Array.from(trie.matches("An ART, with free will and well-being."))).toEqual(["art", "free will", "well-being"]);
  expect(trie.matches("partial freedom willing").size).toBe(0);
  expect(trie.get("free").size).toBe(0);
});

test("new words connect against existing and new definitions, preserving faded cross-links", () => {
  const graph = new VocabularyGraph(entry("root", "A bright idea brings joy."));
  graph.explore(entry("bright", "A light filled with joy."), "definition");
  const result = graph.explore(entry("joy", "A root of pleasure."), "definition");
  expect(result.nodes.map(node => [node.id, node.parent])).toEqual([["root", null], ["bright", "root"], ["joy", "bright"]]);
  const cross = result.edges.find(edge => edge.from === "joy" && edge.to === "root");
  expect(cross?.traversed).toBe(false);
  expect(result.edges.filter(edge => edge.traversed)).toHaveLength(2);
  expect(() => graph.traverse("root")).toThrow("already on your trail");
  expect(graph.snapshot().edges.find(edge => edge.id === cross?.id)?.traversed).toBe(false);
  expect(graph.backtrack().walk).toEqual(["root", "bright"]);
  expect(graph.backtrack().walk).toEqual(["root"]);
  const traversed = graph.traverse("joy");
  expect(traversed.edges.find(edge => edge.id === cross?.id)?.traversed).toBe(true);
  expect(traversed.walk).toEqual(["root", "joy"]);
});

test("synonyms and antonyms are indexed in both directions and remain separate from definition edges", () => {
  const graph = new VocabularyGraph(entry("calm", "Still and quiet.", ["peace"], ["agitation"]));
  let result = graph.explore(entry("still", "Without motion; quiet.", ["calm"], ["moving"]), "definition");
  expect(result.edges.map(edge => [edge.kind, edge.traversed])).toEqual(expect.arrayContaining([["definition", true], ["synonym", false]]));
  result = graph.explore(entry("quiet", "An absence of agitation.", ["peace"], ["calm"]), "definition");
  expect(result.edges.filter(edge => [edge.from, edge.to].includes("calm") && [edge.from, edge.to].includes("quiet")).map(edge => [edge.kind, edge.traversed]))
    .toEqual(expect.arrayContaining([["definition", false], ["antonym", false]]));
  expect(() => graph.traverse("calm", "antonym")).toThrow("already on your trail");
  graph.backtrack(); graph.backtrack(); graph.traverse("quiet", "antonym");
  result = graph.snapshot();
  expect(result.edges.find(edge => edge.kind === "antonym")?.traversed).toBe(true);
  expect(result.edges.find(edge => edge.kind === "definition" && [edge.from, edge.to].includes("quiet") && [edge.from, edge.to].includes("calm"))?.traversed).toBe(false);
  graph.backtrack();
  result = graph.explore(entry("peace", "A state of stillness."), "synonym");
  expect(result.edges.find(edge => edge.kind === "synonym" && [edge.from, edge.to].includes("quiet"))?.traversed).toBe(false);
});

test.each(["definition", "synonym", "antonym"] as const)("%s cross-links find words inside phrases in both directions, including aliases", kind => {
  const withReference = (word: string, text: string) => {
    const value = entry(word, "An independent concept.");
    if (kind === "definition") value.meanings[0].definition = text;
    else value[kind === "synonym" ? "synonyms" : "antonyms"] = [text];
    return value;
  };
  const graph = new VocabularyGraph(entry("root", "Sender receiver newcomer and art."));
  graph.explore(withReference("sender", "A NEWCOMERS, at heart."), "definition");
  graph.backtrack("root");
  graph.explore({ ...entry("receiver", "An independent concept."), forms: ["receivers"] }, "definition");
  graph.backtrack("root");
  graph.explore(entry("art", "An independent concept."), "definition");
  graph.backtrack("root");
  const web = graph.explore({ ...withReference("newcomer", "A RECEIVERS, with partial freedom and an artisan."), forms: ["newcomers"] }, "definition");
  ["sender", "receiver"].forEach(other => {
    expect(web.edges.find(edge => edge.kind === kind && [edge.from, edge.to].includes("newcomer") && [edge.from, edge.to].includes(other)))
      .toMatchObject({ traversed: false });
  });
  expect(web.edges.some(edge => [edge.from, edge.to].includes("newcomer") && [edge.from, edge.to].includes("art"))).toBe(false);
  expect(web.edges.every(edge => edge.from !== edge.to)).toBe(true);
  // An older save can be missing cross-links; reopening discovers them without walking them.
  const restored = VocabularyGraph.restore({ ...web, edges: web.edges.filter(edge => edge.traversed) }).snapshot();
  expect(restored.nodes).toEqual(web.nodes);
  expect(restored.walk).toEqual(web.walk);
  expect(restored.trailEdges).toEqual(web.trailEdges);
  expect(restored.edges).toHaveLength(web.edges.length);
  expect(restored.edges).toEqual(expect.arrayContaining(web.edges));
});

test.each(["synonym", "antonym"] as const)("%s phrases respect word boundaries and word order without linking shared related terms", kind => {
  const field = kind === "synonym" ? "synonyms" : "antonyms";
  const graph = new VocabularyGraph(entry("root", "Choice and free will."));
  graph.explore({ ...entry("choice", "An independent concept."), [field]: ["will free", "partial", "shared"] }, "definition");
  graph.backtrack("root");
  const web = graph.explore({ ...entry("free will", "An independent concept."), [field]: ["shared"] }, "definition");
  expect(web.edges.some(edge => [edge.from, edge.to].includes("choice") && [edge.from, edge.to].includes("free will"))).toBe(false);
});

test("phrase cross-links require matching token order and boundaries", () => {
  const graph = new VocabularyGraph(entry("root", "A choice about free will, art, or a partial reversal."));
  graph.explore(entry("choice", "An act of free will, a free and independent will."), "definition");
  const result = graph.explore(entry("free will", "Independent thought."), "definition");
  expect(result.edges.some(edge => edge.from === "free will" && edge.to === "root")).toBe(true);
  expect(() => graph.explore(entry("art", "Expression."), "definition")).toThrow();
});

test("unrelated discoveries and teleporting to nonadjacent nodes are rejected", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  expect(() => graph.explore(entry("unrelated", "Nothing."), "definition")).toThrow();
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "Foliage."), "definition");
  expect(() => graph.traverse("root")).toThrow("already on your trail");
  expect(() => graph.traverse("missing")).toThrow("Follow a connection");
  expect(graph.snapshot().focus).toBe("leaf");
});

test("loops are rejected before mutation and backtracking pops the trail without deleting discoveries", () => {
  const graph = new VocabularyGraph(entry("root", "A bright beginning."));
  graph.explore(entry("bright", "A root of light."), "definition");
  const before = graph.snapshot();
  expect(() => graph.explore(entry("root", "A changed bright beginning."), "definition")).toThrow("already on your trail");
  expect(graph.snapshot()).toEqual(before);
  expect(graph.backtrack().walk).toEqual(["root"]);
  const result = graph.explore(entry("bright", "A root of light."), "definition");
  expect(result.nodes).toHaveLength(2);
  expect(result.edges).toHaveLength(1);
  expect(result.nodes[1].parent).toBe("root");
  expect(result.walk).toEqual(["root", "bright"]);
  expect(graph.backtrack().edges[0].traversed).toBe(true);
  expect(graph.backtrack().walk).toEqual(["root"]);
});

test("an old tangent is reachable through a new connection after leaving the active trail", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "Foliage."), "definition");
  graph.backtrack(); graph.backtrack();
  graph.explore(entry("beta", "A connection to leaf."), "definition");
  expect(graph.isOnTrail("alpha")).toBe(false);
  const web = graph.traverse("leaf");
  expect(web.walk).toEqual(["root", "beta", "leaf"]);
  expect(web.nodes).toHaveLength(4);
  expect(graph.isOnTrail("leaf")).toBe(true);
});

test("backtracking to any breadcrumb truncates its suffix and leaves every discovery and traversal intact", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  const before = graph.explore(entry("leaf", "A twig."), "definition");
  expect(() => graph.backtrack("missing")).toThrow("current trail");
  expect(graph.snapshot()).toEqual(before);
  const back = graph.backtrack("root");
  expect(back.walk).toEqual(["root"]); expect(back.trailEdges).toEqual([]);
  expect(back.nodes).toEqual(before.nodes); expect(back.edges).toEqual(before.edges);
  expect(graph.isOnTrail("alpha")).toBe(false); expect(graph.isOnTrail("leaf")).toBe(false);
  expect(graph.explore(entry("beta", "A new tangent."), "definition").walk).toEqual(["root", "beta"]);
});

test("the active path remembers the exact relationship among parallel edges", () => {
  const graph = new VocabularyGraph(entry("root", "A bright light.", ["bright"]));
  let web = graph.explore(entry("bright", "Shining."), "synonym");
  expect(web.trailEdges).toEqual([web.edges.find(edge => edge.kind === "synonym")!.id]);
  graph.backtrack(); web = graph.traverse("bright", "definition");
  expect(web.trailEdges).toEqual([web.edges.find(edge => edge.kind === "definition")!.id]);
  expect(web.edges.every(edge => edge.traversed)).toBe(true);
  expect(VocabularyGraph.restore(web).snapshot()).toEqual(web);
});

test("older looping histories become a simple active trail and keep walked edges and positions", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "Foliage."), "definition");
  graph.backtrack(); graph.backtrack();
  const web = graph.explore(entry("beta", "A branch."), "definition");
  const restored = VocabularyGraph.restore({ ...web, trailEdges: undefined, walk: ["root", "alpha", "leaf", "alpha", "root", "beta"] }).snapshot();
  expect(restored.walk).toEqual(["root", "beta"]);
  expect(restored.nodes).toEqual(web.nodes);
  expect(restored.edges).toEqual(web.edges);
  expect(restored.trailEdges).toHaveLength(1);
});

test("shortcuts and unordered saved nodes preserve the active trail without depth metadata", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "A beta."), "definition");
  graph.backtrack(); graph.backtrack();
  graph.explore(entry("beta", "A leaf."), "definition");
  graph.traverse("leaf");
  expect(graph.traverse("alpha").walk).toEqual(["root", "beta", "leaf", "alpha"]);
  const web = graph.snapshot();
  const restored = VocabularyGraph.restore({ ...web, nodes: [...web.nodes].reverse().map(node => ({ ...node, depth: 999 })) });
  expect(restored.snapshot()).toEqual({ ...web, nodes: [...web.nodes].reverse() });
  restored.snapshot().nodes.forEach(node => expect(node).not.toHaveProperty("depth"));
});

test("restoring rejects a disconnected parent cycle without relying on depth metadata", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha."));
  graph.explore(entry("alpha", "Beta."), "definition");
  const web = graph.explore(entry("beta", "A leaf."), "definition");
  expect(() => VocabularyGraph.restore({ ...web, nodes: web.nodes.map(node => node.id === "alpha" ? { ...node, parent: "beta" } : node) }))
    .toThrow("Invalid discovery tree");
});

test("a longest branch can keep growing after backtracking and restoring", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "A twig."), "definition");
  graph.explore(entry("twig", "A beta and seed."), "definition");
  graph.backtrack("root");
  graph.traverse("alpha"); graph.traverse("leaf"); graph.traverse("twig");
  const web = graph.explore(entry("seed", "A new growth."), "definition");
  expect(web.walk).toEqual(["root", "alpha", "leaf", "twig", "seed"]);
  const restored = VocabularyGraph.restore(web);
  expect(restored.explore(entry("growth", "A root."), "definition").walk).toEqual(["root", "alpha", "leaf", "twig", "seed", "growth"]);
  const before = restored.snapshot();
  expect(() => restored.explore(entry("root", "Alpha and beta."), "definition")).toThrow("already on your trail");
  expect(restored.snapshot()).toEqual(before);
  const independent = new VocabularyGraph(entry("seed", "A new growth."));
  expect(independent.explore(entry("growth", "A root."), "definition").walk).toEqual(["seed", "growth"]);
});

test.each([true, false, undefined])("older saved webs ignore the retired trail limit (%s)", trailLimitActive => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "A beta."), "definition");
  graph.explore(entry("beta", "An alpha and growth."), "definition");
  const web = graph.snapshot();
  const legacy = { ...web, trailLimitActive,
    nodes: web.nodes.map(node => node.id === "beta" ? { ...node, parent: "root", depth: 1 } : node) };
  const restored = VocabularyGraph.restore(legacy);
  expect(restored.explore(entry("growth", "A root."), "definition").walk).toEqual(["root", "alpha", "leaf", "beta", "growth"]);
  expect(restored.snapshot()).not.toHaveProperty("trailLimitActive");
  expect(() => restored.traverse("root")).toThrow("already on your trail");
});

test("known inflections cannot bypass trail membership and saved paths cannot name the wrong relationship", () => {
  const graph = new VocabularyGraph({ ...entry("run", "A branch.", ["branch"]), forms: ["ran", "running"] });
  const web = graph.explore(entry("branch", "Run and running.", ["run"]), "definition");
  ["run", "ran", "Running"].forEach(word => {
    expect(graph.isOnTrail(word)).toBe(true);
    expect(() => graph.assertCanExplore(word)).toThrow("already on your trail");
    expect(() => graph.traverse(word)).toThrow("already on your trail");
  });
  const synonym = web.edges.find(edge => edge.kind === "synonym")!;
  expect(() => VocabularyGraph.restore({ ...web, trailEdges: [synonym.id] })).toThrow("trail connections");
});

test("saving and restoring preserves history, positions, traversal, and working indexes", () => {
  const graph = new VocabularyGraph(entry("root", "A bright idea with joy."));
  graph.explore(entry("bright", "A moment of joy."), "definition");
  const snapshot = graph.snapshot();
  const restored = VocabularyGraph.restore(JSON.parse(JSON.stringify(snapshot)));
  expect(restored.snapshot()).toEqual(snapshot);
  const next = restored.explore(entry("joy", "Happiness."), "definition");
  expect(next.edges.find(edge => edge.from === "joy" && edge.to === "root")?.traversed).toBe(false);
  expect(() => VocabularyGraph.restore({ ...next, walk: ["root", "missing"] })).toThrow();
});

test("imports reject broken trees, unsafe entry fields, and invented semantic links", () => {
  const graph = new VocabularyGraph(entry("root", "An alpha."));
  graph.explore(entry("alpha", "A beta."), "definition");
  const snapshot = graph.snapshot();
  const clone = () => JSON.parse(JSON.stringify(snapshot));
  let bad = clone(); bad.nodes[1].parent = "alpha";
  expect(() => VocabularyGraph.restore(bad)).toThrow("discovery tree");
  bad = clone(); bad.nodes[1].entry.phonetic = {};
  expect(() => VocabularyGraph.restore(bad)).toThrow("saved word");
  bad = clone(); bad.edges[0].kind = "antonym";
  expect(() => VocabularyGraph.restore(bad)).toThrow("saved connection");
  bad = clone(); bad.edges[0].traversed = false;
  expect(() => VocabularyGraph.restore(bad)).toThrow("saved trail");
});
