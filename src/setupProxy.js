// CRA loads this Node middleware only when running its development server.
// It is never imported by React or deployed as a Netlify function.
const fs = require("node:fs/promises");
const path = require("node:path");

const loopbackAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function localOrigin(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}

module.exports = function setupWordWebDevelopment(app) {
  if (process.env.NODE_ENV !== "development") return;
  app.get("/__word-web-development", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (process.env.NODE_ENV !== "development") return res.status(404).json({ error: "Not found." });
    // Check the actual connection, never client-supplied forwarding headers.
    if (!loopbackAddresses.has(req.socket.remoteAddress) ||
        !localOrigin(`http://${req.headers.host}`) ||
        req.headers["sec-fetch-site"] === "cross-site" ||
        (req.headers.origin && !localOrigin(req.headers.origin))) {
      return res.status(403).json({ error: "Local development requests only." });
    }
    try {
      const directory = path.join(__dirname, "../.word-web-private");
      const [script, css] = await Promise.all([
        fs.readFile(path.join(directory, "word-web.js"), "utf8"),
        fs.readFile(path.join(directory, "word-web.css"), "utf8"),
      ]);
      return res.json({ script, css });
    } catch {
      return res.status(503).json({ error: "Build Word Web with npm run build:word-web, then retry." });
    }
  });
};
