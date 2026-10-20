import { DictionaryEntry, VocabularyGraph } from "./graph";
import { baseWordForEntry, dictionaryForms, inflectionBase } from "./wordForms";
declare const test: any, expect: any;

const entry = (word: string, definition: string, forms?: string[]): DictionaryEntry => ({
  word, phonetic: "", meanings: [{ partOfSpeech: "verb", definition }], synonyms: [], antonyms: [],
  forms, sourceName: "Test dictionary", sourceUrl: "https://example.com",
});

test("dictionary references identify plurals, irregular pasts, and participles without stemming unrelated words", () => {
  expect(inflectionBase("plural of sugar")).toBe("sugar");
  expect(inflectionBase("simple past of run")).toBe("run");
  expect(inflectionBase("present participle and gerund of run")).toBe("run");
  expect(inflectionBase("third-person singular simple present indicative of cell")).toBe("cell");
  expect(inflectionBase("(nonstandard) simple past tense and past participle of go.")).toBe("go");
  expect(inflectionBase("plural of leave (sense 1)")).toBe("leave");
  expect(inflectionBase("The action of running.")).toBeNull();
  ["glass", "news", "business", "healer"].forEach(word => expect(baseWordForEntry(entry(word, "An independent dictionary headword."))).toBe(word));
  const running = entry("running", "present participle and gerund of run");
  running.meanings.push({ partOfSpeech: "noun", definition: "The activity of running." });
  expect(baseWordForEntry(running)).toBe("run");
  const run = entry("run", "To move swiftly.");
  run.meanings.push({ partOfSpeech: "verb", definition: "past participle of rin" });
  expect(baseWordForEntry(run)).toBe("run");
});

test("only grammatical forms are aliases, excluding dictionary table metadata and alternative spellings", () => {
  expect(dictionaryForms([
    { word: "runs", tags: ["present", "singular", "third-person"] },
    { word: "running", tags: ["participle", "present"] },
    { word: "ran", tags: ["past"] }, { word: "ran", tags: ["past", "participle"] },
    { word: "no-table-tags", tags: ["table-tags"] }, { word: "glossary", tags: ["inflection-template"] },
    { word: "rin", tags: ["alternative", "dialectal"] }, { word: "runneth", tags: ["archaic", "present"] },
  ])).toEqual(["runs", "running", "ran"]);
});

test("inflected clicks reuse one node and cross-links recognize variants in all three relationship types", () => {
  const trail = entry("trail", "Running and sugars create motion.");
  trail.synonyms = ["sugars"]; trail.antonyms = ["ran"];
  const graph = new VocabularyGraph(trail);
  const run = entry("run", "To move swiftly by running.", ["ran", "running", "runs"]);
  graph.explore(run, "definition", "Running");
  graph.backtrack();
  const sugar = entry("sugar", "A fuel for running.", ["sugars"]);
  const web = graph.explore(sugar, "definition", "sugars");
  expect(web.nodes.map(node => node.id)).toEqual(["trail", "run", "sugar"]);
  expect(graph.getEntry("ran")?.word).toBe("run");
  expect(graph.getEntry("sugars")?.word).toBe("sugar");
  expect(web.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ from: "run", to: "sugar", kind: "definition", traversed: false }),
    expect.objectContaining({ from: "run", to: "trail", kind: "antonym", traversed: false }),
    expect.objectContaining({ from: "sugar", to: "trail", kind: "synonym", traversed: false }),
  ]));
  graph.backtrack();
  graph.explore(run, "definition", "Running");
  expect(graph.snapshot().nodes).toHaveLength(3);
  const current = graph.snapshot();
  graph.explore(run, "definition", "running");
  expect(graph.snapshot().walk).toEqual(current.walk);
});

test("saved plural duplicates merge into the base entry, preserving coordinates, walked links, and a valid history", () => {
  const graph = new VocabularyGraph(entry("trail", "Sweet sugars and sugar."));
  graph.explore(entry("sugars", "plural of sugar"), "definition");
  graph.explore(entry("sugar", "Sweet crystals."), "definition");
  graph.backtrack(); graph.backtrack();
  const old = { ...graph.snapshot(), trailEdges: undefined, walk: ["trail", "sugars", "sugar", "sugars", "trail"] };
  const oldSugar = old.nodes.find(node => node.id === "sugar")!;
  const restored = VocabularyGraph.restore(JSON.parse(JSON.stringify(old)));
  const web = restored.snapshot();
  expect(web.nodes.map(node => node.id)).toEqual(["trail", "sugar"]);
  expect(web.nodes[1]).toMatchObject({ x: oldSugar.x, y: oldSugar.y, parent: "trail", depth: 1 });
  expect(web.nodes[1].entry.meanings[0].definition).toBe("Sweet crystals.");
  expect(web.edges).toHaveLength(1);
  expect(web.edges[0].traversed).toBe(true);
  expect(web.walk).toEqual(["trail"]);
  expect(restored.getEntry("sugars")?.word).toBe("sugar");
  expect(VocabularyGraph.restore(JSON.parse(JSON.stringify(web))).snapshot()).toEqual(web);
});

test("a renamed saved inflection can load its real base definition without moving any nodes or losing old links", () => {
  const graph = new VocabularyGraph(entry("trail", "We ran."));
  graph.explore(entry("ran", "simple past of run"), "definition");
  const original = graph.snapshot().nodes[1];
  const restored = VocabularyGraph.restore(JSON.parse(JSON.stringify(graph.snapshot())));
  expect(restored.snapshot().focus).toBe("run");
  expect(restored.getEntry("run")?.needsLookup).toBe(true);
  const updated = restored.refreshEntry(entry("run", "To move swiftly.", ["runs", "ran", "running"]));
  expect(updated.nodes[1]).toMatchObject({ id: "run", x: original.x, y: original.y });
  expect(updated.nodes[1].entry.meanings[0].definition).toBe("To move swiftly.");
  expect(updated.nodes[1].entry.needsLookup).toBeUndefined();
  expect(updated.walk).toEqual(["trail", "run"]);
  expect(VocabularyGraph.restore(JSON.parse(JSON.stringify(updated))).snapshot()).toEqual(updated);
});

test("when the root itself was an inflection, merging keeps the canonical node and leaves no self-loops", () => {
  const graph = new VocabularyGraph(entry("sugars", "plural of sugar"));
  graph.explore(entry("sugar", "Sweet crystals."), "definition");
  const restored = VocabularyGraph.restore(JSON.parse(JSON.stringify(graph.snapshot()))).snapshot();
  expect(restored.root).toBe("sugar"); expect(restored.focus).toBe("sugar");
  expect(restored.nodes).toHaveLength(1); expect(restored.nodes[0].parent).toBeNull();
  expect(restored.edges).toHaveLength(0); expect(restored.walk).toEqual(["sugar"]);
});
