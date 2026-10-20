import { DictionaryEntry, VocabularyGraph, WordTrie } from "./graph";
declare const test: any, expect: any;

const entry = (word: string, definition: string, synonyms: string[] = [], antonyms: string[] = []): DictionaryEntry => ({
  word, phonetic: "", meanings: [{ partOfSpeech: "noun", definition }], synonyms, antonyms,
  sourceName: "Test dictionary", sourceUrl: "https://example.com",
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
  expect(result.nodes.map(node => [node.id, node.parent, node.depth])).toEqual([["root", null, 0], ["bright", "root", 1], ["joy", "bright", 2]]);
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

test("the cached discovery-path length survives backtracking, shortcuts, and unordered saved nodes", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  expect(graph.longestDiscoveryPath()).toBe(0);
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "A beta."), "definition");
  expect(graph.longestDiscoveryPath()).toBe(2);
  graph.backtrack(); graph.backtrack();
  graph.explore(entry("beta", "A leaf."), "definition");
  graph.traverse("leaf");
  expect(() => graph.traverse("alpha")).toThrow("Trail limit reached");
  expect(graph.snapshot().walk).toHaveLength(3);
  expect(graph.longestDiscoveryPath()).toBe(2);
  const web = graph.snapshot();
  const restored = VocabularyGraph.restore({ ...web, nodes: [...web.nodes].reverse() });
  expect(restored.longestDiscoveryPath()).toBe(2);
});

test("a fresh web establishes its first branch, then limits all forward steps after backtracking", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  expect(graph.atTrailLimit()).toBe(false);
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "A twig."), "definition");
  graph.explore(entry("twig", "A beta and seed."), "definition");
  expect(graph.snapshot().trailLimitActive).toBe(false);
  graph.backtrack("root");
  graph.traverse("alpha"); graph.traverse("leaf"); graph.traverse("twig");
  const before = graph.snapshot();
  expect(graph.atTrailLimit()).toBe(true);
  expect(() => graph.explore(entry("seed", "A new growth."), "definition")).toThrow("Trail limit reached");
  expect(graph.snapshot()).toEqual(before);
  const restored = VocabularyGraph.restore(before);
  expect(restored.atTrailLimit()).toBe(true);
  restored.backtrack("leaf");
  expect(restored.atTrailLimit()).toBe(false);
  expect(restored.traverse("twig").walk).toEqual(["root", "alpha", "leaf", "twig"]);
  const independent = new VocabularyGraph(entry("seed", "A new growth."));
  expect(independent.atTrailLimit()).toBe(false);
  expect(independent.snapshot().trailLimitActive).toBe(false);
});

test("older saved webs enforce the limit even when an old looping walk was longer than its discovery tree", () => {
  const graph = new VocabularyGraph(entry("root", "Alpha and beta."));
  graph.explore(entry("alpha", "A leaf."), "definition");
  graph.explore(entry("leaf", "A beta."), "definition");
  graph.explore(entry("beta", "An alpha."), "definition");
  const web = graph.snapshot();
  const legacy = { ...web, trailLimitActive: undefined,
    nodes: web.nodes.map(node => node.id === "beta" ? { ...node, parent: "root", depth: 1 } : node) };
  const restored = VocabularyGraph.restore(legacy);
  expect(restored.atTrailLimit()).toBe(true);
  expect(restored.longestDiscoveryPath()).toBe(2);
  expect(() => restored.assertCanExplore("growth")).toThrow("Trail limit reached");
  restored.backtrack("alpha");
  expect(restored.atTrailLimit()).toBe(false);
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
