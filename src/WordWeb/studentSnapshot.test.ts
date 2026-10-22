// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any;
import { VocabularyGraph } from "./graph";
import { STARTER_ENTRIES } from "./starterEntries";
import { restoreStudentWeb } from "./studentSnapshot";

test("restores safe student webs with their saved trail and coordinates", () => {
  const graph = new VocabularyGraph(STARTER_ENTRIES[0]);
  graph.explore(STARTER_ENTRIES[1], "synonym");
  const snapshot = graph.snapshot();
  expect(restoreStudentWeb(snapshot).snapshot()).toEqual(snapshot);
});

test("rejects unrestricted sources, filtered content and poisoned reference text", () => {
  for (const changes of [
    { sourceName: "Wiktionary via FreeDictionaryAPI" },
    { studentPolicy: undefined },
    { synonyms: ["shit"] },
    { formReferences: { definition: ["A sexual reference."], synonym: [], antonym: [] } },
    { meanings: [{ partOfSpeech: "noun", definition: "An offensive definition." }] },
  ]) {
    const snapshot = JSON.parse(JSON.stringify(new VocabularyGraph(STARTER_ENTRIES[0]).snapshot()));
    Object.assign(snapshot.nodes[0].entry, changes);
    expect(() => restoreStudentWeb(snapshot)).toThrow("Only student Word Web files");
  }
});
