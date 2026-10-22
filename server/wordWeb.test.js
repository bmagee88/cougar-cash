const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDictionaryHandler, parseStudentDictionary, dictionaryText } = require("./wordWeb");

const sense = (definition, extra = {}) => ["sense", { dt: [["text", definition]], ...extra }];
const record = (extra = {}) => ({
  meta: { id: "planet", src: "sd2", offensive: false, stems: ["planet", "planets", "planetary"] },
  hwi: { hw: "plan*et", prs: [{ mw: "ˈpla-nət" }] }, fl: "noun",
  def: [{ sseq: [[sense("A large object that travels around a {a_link|star}.", {
    syn_list: [[{ wd: "world" }, { wd: "shit" }]], ant_list: [[{ wd: "nothing" }]],
  })]] }], ...extra,
});
const event = word => ({ httpMethod: "GET", queryStringParameters: { word } });
const reply = data => ({ ok: true, status: 200, json: async () => data });

test("parses nested student senses, markup, examples, relationships and confirmed inflections", () => {
  const data = record();
  data.def[0].sseq[0][0][1].sdsense = { dt: [["text", "A world in space."], ["vis", [{ t: "Our {wi}planet{/wi} is Earth." }]]] };
  const entry = parseStudentDictionary([data], "planets");
  assert.equal(entry.word, "planet");
  assert.equal(entry.meanings[0].definition, "A large object that travels around a star.");
  assert.equal(entry.meanings[1].example, "Our planet is Earth.");
  assert.deepEqual(entry.synonyms, ["world"]);
  assert.deepEqual(entry.antonyms, ["nothing"]);
  assert.deepEqual(entry.forms, ["planets"]);
  assert.equal(entry.sourceName, "Merriam-Webster Elementary Dictionary");
  assert.equal(dictionaryText("{bc}{it}a{/it} {sx|world||}"), "a world");
});

test("rejects adult dictionaries, offensive or unclassified entries, suggestions and mismatched headwords", () => {
  assert.equal(parseStudentDictionary(["planet", "shit"], "plannet"), null);
  assert.equal(parseStudentDictionary([record()], "unknown"), null);
  for (const meta of [{ src: "collegiate", offensive: false }, { src: "sd2", offensive: true }, { src: "sd2" }]) {
    assert.equal(parseStudentDictionary([record({ meta: { id: "planet", ...meta } })], "planet"), null);
  }
});

test("extracts student dictionary synonym discussion terms without inventing antonyms", () => {
  const data = record({ syns: [{ pl: "synonyms", pt: [["text", "{sc}planet{/sc} and {sc}world{/sc} name places in space."]] }] });
  delete data.def[0].sseq[0][0][1].syn_list;
  delete data.def[0].sseq[0][0][1].ant_list;
  const entry = parseStudentDictionary([data], "planet");
  assert.deepEqual(entry.synonyms, ["world"]);
  assert.deepEqual(entry.antonyms, []);
});

test("removes sensitive senses and examples without hiding harmless senses", () => {
  const data = record({ def: [{ sseq: [[
    sense("A world in space.", { dt: [["text", "A world in space."], ["vis", [{ t: "A bloody planet." }]]] }),
    sense("A sexual reference."), sense("An ordinary looking description.", { sls: ["vulgar"] }),
  ]] }] });
  const entry = parseStudentDictionary([data], "planet");
  assert.deepEqual(entry.meanings, [{ partOfSpeech: "noun", definition: "A world in space." }]);
  assert.equal(parseStudentDictionary([record({ def: [{ sseq: [[sense("A sexual reference.")]] }] })], "planet"), null);
});

test("rejects blocked queries before any request and never echoes them", async () => {
  let calls = 0;
  const handler = createDictionaryHandler({ getKey: () => "secret", fetchImpl: async () => { calls++; return reply([]); } });
  for (const word of ["shit", "sexual", "cocaine", "murder"]) {
    const result = await handler(event(word));
    assert.equal(result.statusCode, 404);
    assert.equal(JSON.parse(result.body).code, "filtered");
    assert.ok(!result.body.includes(word));
  }
  assert.equal(calls, 0);
});

test("reports missing configuration without fetching", async () => {
  const handler = createDictionaryHandler({ getKey: () => "", fetchImpl: () => assert.fail("Unexpected fetch") });
  assert.equal(JSON.parse((await handler(event("planet"))).body).code, "configuration");
  assert.equal((await handler({ ...event("planet"), httpMethod: "POST" })).statusCode, 405);
  assert.equal((await handler(event("https://example.com"))).statusCode, 400);
});

test("uses only sd2, shares concurrent requests, caches results, expires cache and keeps key private", async () => {
  let calls = 0, time = 0;
  const handler = createDictionaryHandler({ getKey: () => "private-key", now: () => time, fetchImpl: async url => {
    calls++;
    assert.equal(new URL(url).hostname, "www.dictionaryapi.com");
    assert.equal(new URL(url).pathname, "/api/v3/references/sd2/json/planet");
    return reply([record()]);
  } });
  const [first, second] = await Promise.all([handler(event("planet")), handler(event("planet"))]);
  assert.equal(first.statusCode, 200); assert.deepEqual(first, second);
  await handler(event("planet")); assert.equal(calls, 1);
  time = 3600001;
  await handler(event("planet")); assert.equal(calls, 2);
  assert.ok(!first.body.includes("private-key"));
});

test("upstream failures are retryable and suggestion strings never escape the server", async () => {
  let calls = 0;
  const handler = createDictionaryHandler({ getKey: () => "private-key", fetchImpl: async () => {
    calls++;
    if (calls === 1) throw new Error("https://example.com/?key=private-key");
    return reply(["planet", "shit"]);
  } });
  const result = await handler(event("plannet"));
  assert.equal(result.statusCode, 503); assert.ok(!result.body.includes("private-key"));
  const retry = await handler(event("plannet"));
  assert.equal(retry.statusCode, 404); assert.ok(!retry.body.includes("shit")); assert.equal(calls, 2);
});

test("authentication and quota failures return friendly errors", async () => {
  for (const status of [401, 403, 429]) {
    const handler = createDictionaryHandler({ getKey: () => "private-key", fetchImpl: async () => ({ ok: false, status }) });
    const result = await handler(event("planet"));
    assert.equal(result.statusCode, 503);
    assert.equal(JSON.parse(result.body).code, status === 429 ? "unavailable" : "configuration");
  }
});
