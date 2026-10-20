const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createWordWebAccess } = require("./wordWebAccess");

// Read the one server-only check so the real password is not duplicated in fixtures.
const password = fs.readFileSync(require.resolve("./wordWebAccess"), "utf8").match(/digest\("([^\"]+)"\)/)[1];
const email = "mageebrian1988@gmail.com";
const origin = "https://words.example.test";
const clientId = "test-client.apps.googleusercontent.com";
const baseConfiguration = { clientId, secret: "a-test-only-secret-of-at-least-32-characters", origins: new Set([origin]) };

async function setup(overrides = {}) {
  let clock = 1000000;
  let nonce;
  let bundleReads = 0;
  let tokenChecks = 0;
  const payload = () => ({ sub: "google-user-id", email, email_verified: true, nonce });
  const handler = createWordWebAccess({
    getConfiguration: async () => baseConfiguration,
    verifyGoogle: async (credential, audience) => {
      tokenChecks += 1;
      assert.equal(credential, "google-signed-test-credential");
      assert.equal(audience, clientId);
      return payload();
    },
    loadBundle: async () => { bundleReads += 1; return { script: "private-application", css: "private-styles" }; },
    now: () => clock,
    ...overrides,
  });
  const config = await handler({ method: "GET", pathname: "/api/word-web/config", headers: { origin } });
  if (config.statusCode === 200) nonce = JSON.parse(config.body).nonce;
  const request = {
    method: "POST", pathname: "/api/word-web/unlock", ip: "192.0.2.1",
    headers: { origin, "content-type": "application/json", cookie: config.headers["Set-Cookie"]?.split(";")[0] },
    body: JSON.stringify({ email, password, credential: "google-signed-test-credential" }),
  };
  return { handler, config, request, payload, reads: () => bundleReads, checks: () => tokenChecks, advance: ms => { clock += ms; } };
}
const denied = result => { assert.equal(result.statusCode, 403); assert.ok(!result.body.includes("private-application")); };

test("only verified, allowlisted Google identity plus password releases private code", async () => {
  const app = await setup();
  assert.equal(app.config.statusCode, 200);
  assert.deepEqual(Object.keys(JSON.parse(app.config.body)).sort(), ["clientId", "nonce"]);
  assert.match(app.config.headers["Set-Cookie"], /HttpOnly; SameSite=Strict/);
  assert.match(app.config.headers["Set-Cookie"], /Secure/);
  const result = await app.handler(app.request);
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).script, "private-application");
  assert.equal(app.reads(), 1);
  assert.equal(app.checks(), 1);
  assert.match(result.headers["Cache-Control"], /no-store/);
  assert.equal(result.headers["Netlify-CDN-Cache-Control"], "no-store");
  assert.match(result.headers["Set-Cookie"], /Max-Age=0/);
  assert.equal(result.headers["Access-Control-Allow-Origin"], undefined);
});

test("wrong/missing password, email, credentials and client flags never load the bundle", async () => {
  const app = await setup();
  const valid = JSON.parse(app.request.body);
  for (const patch of [{ password: "incorrect" }, { password: "" }, { email: "someone@example.test" }, { credential: undefined }, { credential: { sub: "fake" } }, { password: undefined, unlocked: true, isAdmin: true, authenticated: true }]) {
    denied(await app.handler({ ...app.request, body: JSON.stringify({ ...valid, ...patch }) }));
  }
  assert.equal(app.reads(), 0);
});

test("email comparison normalizes case and whitespace without accepting different addresses", async () => {
  const app = await setup();
  const body = { ...JSON.parse(app.request.body), email: `  ${email.toUpperCase()}  ` };
  assert.equal((await app.handler({ ...app.request, body: JSON.stringify(body) })).statusCode, 200);
});

test("forged, unverified, mismatched-account and wrong-nonce Google identities fail closed", async () => {
  for (const identity of [null, {}, { sub: "id", email, email_verified: false }, { sub: "id", email, email_verified: "true" }, { sub: "id", email: "other@gmail.com", email_verified: true }, { sub: "id", email, email_verified: true, nonce: "forged" }]) {
    const app = await setup({ verifyGoogle: async () => identity });
    denied(await app.handler(app.request));
    assert.equal(app.reads(), 0);
  }
  const app = await setup({ verifyGoogle: async () => { throw new Error("Invalid Google signature"); } });
  denied(await app.handler(app.request));
  assert.equal(app.reads(), 0);
});

test("production Google verifier rejects a malformed credential", async () => {
  const app = await setup({ verifyGoogle: undefined });
  denied(await app.handler({ ...app.request, body: JSON.stringify({ email, password, credential: "not-a-signed-google-token" }) }));
  assert.equal(app.reads(), 0);
});

test("missing, tampered, expired and previously cleared challenges cannot unlock", async () => {
  const app = await setup();
  for (const cookie of ["", "word_web_challenge=forged", `${app.request.headers.cookie}tampered`]) {
    denied(await app.handler({ ...app.request, headers: { ...app.request.headers, cookie } }));
  }
  app.advance(600001);
  denied(await app.handler(app.request));
  assert.equal(app.reads(), 0);
  const fresh = await setup();
  const unlocked = await fresh.handler(fresh.request);
  denied(await fresh.handler({ ...fresh.request, headers: { ...fresh.request.headers, cookie: unlocked.headers["Set-Cookie"].split(";")[0] } }));
});

test("every visit gets a fresh Google nonce", async () => {
  const app = await setup();
  const second = await app.handler({ method: "GET", pathname: "/api/word-web/config", headers: { origin } });
  assert.notEqual(JSON.parse(second.body).nonce, JSON.parse(app.config.body).nonce);
  denied(await app.handler({ ...app.request, headers: { ...app.request.headers, cookie: second.headers["Set-Cookie"].split(";")[0] } }));
  assert.equal(app.reads(), 0);
});

test("direct GET, alternate paths, wrong origins and cross-site requests never release code", async () => {
  const app = await setup();
  for (const method of ["GET", "HEAD", "PUT", "OPTIONS"]) assert.equal((await app.handler({ ...app.request, method })).statusCode, 405);
  for (const pathname of ["/api/word-web/app", "/api/word-web/unlock/", "/.netlify/functions/word-web-access"]) assert.equal((await app.handler({ ...app.request, pathname })).statusCode, 404);
  for (const headers of [{ ...app.request.headers, origin: "https://evil.example.test" }, { ...app.request.headers, origin: `${origin}/path` }, { ...app.request.headers, origin: undefined }, { ...app.request.headers, "sec-fetch-site": "cross-site" }]) denied(await app.handler({ ...app.request, headers }));
  assert.equal(app.reads(), 0);
});

test("CRA proxy's trailing-slash origin remains compatible with exact allowed origins", async () => {
  const app = await setup();
  assert.equal((await app.handler({ ...app.request, headers: { ...app.request.headers, origin: `${origin}/` } })).statusCode, 200);
});

test("missing deployment configuration and private bundle fail closed", async () => {
  for (const patch of [{ clientId: "" }, { secret: "" }, { origins: new Set() }]) {
    const app = await setup({ getConfiguration: async () => ({ ...baseConfiguration, ...patch }) });
    assert.equal(app.config.statusCode, 503);
    assert.equal((await app.handler(app.request)).statusCode, 503);
    assert.equal(app.reads(), 0);
  }
  const app = await setup({ loadBundle: async () => { throw new Error("file missing"); } });
  assert.equal((await app.handler(app.request)).statusCode, 503);
});

test("attempt limits cannot be bypassed by resetting browser state", async () => {
  const app = await setup();
  const request = { ...app.request, body: JSON.stringify({ email, password: "wrong" }) };
  for (let i = 0; i < 10; i += 1) denied(await app.handler(request));
  const result = await app.handler(app.request);
  assert.equal(result.statusCode, 429);
  assert.equal(result.headers["Retry-After"], "600");
  assert.equal(app.reads(), 0);
  app.advance(600001);
  const config = await app.handler({ method: "GET", pathname: "/api/word-web/config", headers: { origin } });
  // The old challenge also expires, independently of the rate limit.
  assert.equal(config.statusCode, 200);
  denied(await app.handler(app.request));
});

test("oversized, malformed and non-JSON requests are rejected before authentication", async () => {
  const app = await setup();
  assert.equal((await app.handler({ ...app.request, body: "x".repeat(24577) })).statusCode, 413);
  for (const body of ["{broken", "null", "[]"]) assert.equal((await app.handler({ ...app.request, body })).statusCode, 400);
  assert.equal((await app.handler({ ...app.request, headers: { ...app.request.headers, "content-type": "text/plain" } })).statusCode, 415);
  assert.equal(app.checks(), 0);
  assert.equal(app.reads(), 0);
});
