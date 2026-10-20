const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const register = require("../src/setupProxy");

const originalMode = process.env.NODE_ENV;
afterEach(() => {
  if (originalMode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalMode;
  mock.restoreAll();
});

function middleware(mode = "development") {
  process.env.NODE_ENV = mode;
  let handler;
  register({ get: (pathname, callback) => { assert.equal(pathname, "/__word-web-development"); handler = callback; } });
  return handler;
}
function request(patch = {}) {
  return { socket: { remoteAddress: "::ffff:127.0.0.1" }, headers: { host: "localhost:3001", "sec-fetch-site": "same-origin" }, ...patch };
}
function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("the bypass endpoint is never registered outside the development server", () => {
  for (const mode of ["production", "test", ""]) assert.equal(middleware(mode), undefined);
});

test("local development loads the bundle without credentials or Google configuration", async () => {
  const read = mock.method(fs, "readFile", async file => file.endsWith(".js") ? "private-app" : "private-css");
  const handler = middleware();
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { script: "private-app", css: "private-css" });
  assert.match(res.headers["Cache-Control"], /no-store/);
  assert.equal(read.mock.callCount(), 2);
});

test("remote connections cannot impersonate localhost using request headers", async () => {
  const read = mock.method(fs, "readFile", async () => "must-not-be-read");
  const handler = middleware();
  const res = response();
  await handler(request({ socket: { remoteAddress: "203.0.113.10" }, headers: {
    host: "localhost:3001", origin: "http://localhost:3001", "x-forwarded-for": "127.0.0.1", "x-real-ip": "127.0.0.1",
  } }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(read.mock.callCount(), 0);
});

test("external hosts, cross-site requests and untrusted origins cannot use the local bypass", async () => {
  const read = mock.method(fs, "readFile", async () => "must-not-be-read");
  const handler = middleware();
  for (const patch of [{ host: "public.example.test" }, { origin: "https://evil.example.test" }, { origin: "http://localhost:3001/evil" }, { "sec-fetch-site": "cross-site" }]) {
    const res = response();
    await handler(request({ headers: { host: "localhost:3001", ...patch } }), res);
    assert.equal(res.statusCode, 403);
  }
  assert.equal(read.mock.callCount(), 0);
});

test("switching to production also disables an already registered development endpoint", async () => {
  const read = mock.method(fs, "readFile", async () => "must-not-be-read");
  const handler = middleware();
  process.env.NODE_ENV = "production";
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(read.mock.callCount(), 0);
});

test("a missing private build fails without returning app code", async () => {
  mock.method(fs, "readFile", async () => { throw new Error("missing"); });
  const handler = middleware();
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.script, undefined);
});
