import { lookupWord, parseDictionaryApi, parseWiktionary, rememberEntries } from "./dictionary";
declare const test: any, expect: any, jest: any;

test("Wiktionary parsing includes all entries, nested senses, and both levels of relations", () => {
  const entry = parseWiktionary({ entries: [{
    partOfSpeech: "noun", language: { code: "en" }, pronunciations: [{ type: "ipa", text: "/test/" }],
    synonyms: ["trial"], antonyms: [], senses: [{ definition: "An examination.", examples: ["A test."], synonyms: ["Trial"],
      subsenses: [{ definition: "A challenge.", antonyms: ["certainty"], synonyms: ["quiz"] }] }],
  }] }, "TEST");
  expect(entry?.word).toBe("test");
  expect(entry?.meanings).toHaveLength(2);
  expect(entry?.synonyms).toEqual(["trial", "quiz"]);
  expect(entry?.antonyms).toEqual(["certainty"]);
  expect(entry?.meanings[0].example).toBe("A test.");
  expect(entry?.sourceUrl).toBe("https://en.wiktionary.org/wiki/test");
});

test("fallback parsing collects relations from meanings and individual definitions", () => {
  const entry = parseDictionaryApi([{ phonetics: [{ text: "/test/" }], meanings: [{ partOfSpeech: "noun", synonyms: ["trial"],
    definitions: [{ definition: "An examination.", synonyms: ["quiz"], antonyms: ["certainty"] }] }] }], "test");
  expect(entry?.synonyms).toEqual(["trial", "quiz"]);
  expect(entry?.antonyms).toEqual(["certainty"]);
  expect(parseDictionaryApi({ title: "Not found" }, "test")).toBeNull();
  expect(parseWiktionary({ entries: [] }, "test")).toBeNull();
});

test("concurrent lookups share one request and successful responses are cached", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ entries: [{ partOfSpeech: "noun", senses: [{ definition: "A test example." }] }] }) });
  global.fetch = fetchMock;
  try {
    const [first, second] = await Promise.all([lookupWord("lexicography"), lookupWord("Lexicography")]);
    expect(first).toEqual(second);
    await lookupWord("lexicography");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally { global.fetch = original; }
});

test("a provider outage falls back without inventing a definition", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, status: 200,
    json: async () => [{ meanings: [{ partOfSpeech: "adjective", definitions: [{ definition: "Lasting for a short time." }] }] }] });
  global.fetch = fetchMock;
  try {
    expect((await lookupWord("ephemeral")).meanings[0].definition).toBe("Lasting for a short time.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally { global.fetch = original; }
});

test("failed requests can be retried and invalid input is never sent", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn().mockRejectedValue(new Error("offline"));
  global.fetch = fetchMock;
  try {
    await expect(lookupWord("bad<script>")).rejects.toMatchObject({ reason: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(lookupWord("unreachable")).rejects.toMatchObject({ reason: "network" });
    await expect(lookupWord("unreachable")).rejects.toMatchObject({ reason: "network" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  } finally { global.fetch = original; }
});

test("ran and running resolve to run, share the base lookup, and cache all dictionary forms", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn(async (url: string) => {
    const word = decodeURIComponent(url.split("/").pop()!);
    const data = word === "run" ? { entries: [
      { partOfSpeech: "verb", forms: [{ word: "ran", tags: ["past"] }, { word: "running", tags: ["present", "participle"] }, { word: "runs", tags: ["present"] }], senses: [{ definition: "To move swiftly." }] },
      { partOfSpeech: "verb", senses: [{ definition: "past participle of rin" }] },
    ] } : { entries: [{ partOfSpeech: "verb", senses: [{ definition: word === "ran" ? "simple past of run" : "present participle and gerund of run" }] }] };
    return { ok: true, status: 200, json: async () => data };
  });
  global.fetch = fetchMock as any;
  try {
    const entries = await Promise.all([lookupWord("ran"), lookupWord("running")]);
    expect(entries.map(entry => entry.word)).toEqual(["run", "run"]);
    expect(entries[0].meanings[0].definition).toBe("To move swiftly.");
    expect(entries[0].sourceUrl).toBe("https://en.wiktionary.org/wiki/run");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url]: string[]) => url.endsWith("/run"))).toHaveLength(1);
    for (const word of ["run", "ran", "running", "runs"]) expect((await lookupWord(word)).word).toBe("run");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally { global.fetch = original; }
});

test("plural lookup loads the singular definition, instead of displaying only 'plural of'", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ entries: [{ partOfSpeech: "noun",
    forms: url.endsWith("/sugar") ? [{ word: "sugars", tags: ["plural"] }] : [],
    senses: [{ definition: url.endsWith("/sugars") ? "plural of sugar" : "Sweet crystals used in food." }],
  }] }) }));
  global.fetch = fetchMock as any;
  try {
    const result = await lookupWord("sugars");
    expect(result.word).toBe("sugar"); expect(result.forms).toContain("sugars");
    expect(result.meanings[0].definition).toBe("Sweet crystals used in food.");
    expect((await lookupWord("sugar")).word).toBe("sugar");
    expect((await lookupWord("sugars")).word).toBe("sugar");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally { global.fetch = original; }
});

test("the fallback can return a canonical headword directly", async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, status: 200,
    json: async () => [{ word: "go", meanings: [{ partOfSpeech: "verb", definitions: [{ definition: "To move from one place to another." }] }] }] });
  try {
    const result = await lookupWord("went");
    expect(result.word).toBe("go"); expect(result.forms).toContain("went");
    expect(result.sourceUrl).toBe("https://en.wiktionary.org/wiki/go");
  } finally { global.fetch = original; }
});

test("concurrent circular dictionary references fail cleanly rather than deadlocking", async () => {
  const original = global.fetch;
  global.fetch = jest.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ entries: [{ partOfSpeech: "noun",
    senses: [{ definition: `plural of ${url.endsWith("formcyclea") ? "formcycleb" : "formcyclea"}` }],
  }] }) })) as any;
  try {
    const results = await Promise.allSettled([lookupWord("formcyclea"), lookupWord("formcycleb")]);
    expect(results.every(result => result.status === "rejected")).toBe(true);
  } finally { global.fetch = original; }
});

test("learning another alias never drops previously cached variants", async () => {
  const root = parseWiktionary({ entries: [{ partOfSpeech: "verb", senses: [{ definition: "To swim." }] }] }, "swim")!;
  rememberEntries([{ ...root, forms: ["swam", "swimming"] }]);
  rememberEntries([{ ...root, forms: ["swims"] }]);
  const entry = await lookupWord("swimming");
  expect(entry.word).toBe("swim");
  expect(entry.forms).toEqual(expect.arrayContaining(["swam", "swimming", "swims"]));
});
