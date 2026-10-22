// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any, jest: any, afterEach: any;
import { lookupWord, rememberEntries, LookupError } from "./dictionary";
import { STARTER_ENTRIES } from "./starterEntries";
import { STUDENT_SOURCE } from "./studentSafety";

const liveEntry = (word: string) => ({ ...STARTER_ENTRIES[0], word,
  sourceName: STUDENT_SOURCE, sourceUrl: "https://dictionaryapi.com/products/api-elementary-dictionary", forms: [] as string[],
});
const response = (body: any, status = 200) => ({ ok: status === 200, status,
  headers: { get: () => "application/json" }, json: async () => body,
});
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("starter words use original reviewed text and work without a network", async () => {
  global.fetch = jest.fn();
  expect(await lookupWord("Curiosity")).toEqual(STARTER_ENTRIES[0]);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("only calls the local student endpoint, deduplicates, caches, and reuses inflections", async () => {
  const entry = { ...liveEntry("planet"), forms: ["planets"] };
  const fetchMock = jest.fn().mockResolvedValue(response({ entry }));
  global.fetch = fetchMock;
  const [first, second] = await Promise.all([lookupWord("planet"), lookupWord("planet")]);
  expect(first).toEqual(second);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/word-web/dictionary?word=planet");
  expect((await lookupWord("planets")).word).toBe("planet");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("rejects inappropriate queries and untrusted remembered entries before the cache", async () => {
  global.fetch = jest.fn();
  rememberEntries([{ ...liveEntry("shit") }]);
  await expect(lookupWord("shit")).rejects.toMatchObject({ reason: "filtered" });
  await expect(lookupWord("https://example.com")).rejects.toBeInstanceOf(LookupError);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("rejects an unsafe server payload and retries failed requests without other providers", async () => {
  const fetchMock = jest.fn().mockResolvedValueOnce(response({ entry: { ...liveEntry("unsafeentry"), synonyms: ["shit"] } }))
    .mockResolvedValueOnce(response({ entry: liveEntry("unsafeentry") }));
  global.fetch = fetchMock;
  await expect(lookupWord("unsafeentry")).rejects.toMatchObject({ reason: "filtered" });
  expect((await lookupWord("unsafeentry")).word).toBe("unsafeentry");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([[503, "configuration"], [404, "missing"], [404, "filtered"]])("handles %s/%s responses", async (status, code) => {
  global.fetch = jest.fn().mockResolvedValue(response({ code, message: "untrusted upstream content" }, status as number));
  await expect(lookupWord(`missing${code}`)).rejects.toMatchObject({ reason: code });
});

test("an HTML SPA fallback is a connection error and does not become a dictionary entry", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => "text/html" } });
  await expect(lookupWord("unavailableword")).rejects.toMatchObject({ reason: "network" });
});
