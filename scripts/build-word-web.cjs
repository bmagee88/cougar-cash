const path = require("node:path");
const fs = require("node:fs");
const esbuild = require("esbuild");

const project = path.resolve(__dirname, "..");
const options = {
  absWorkingDir: project,
  entryPoints: ["src/WordWeb/privateEntry.tsx"],
  outfile: ".word-web-private/word-web.js",
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  target: ["es2019"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
};

async function main() {
  if (process.argv.includes("--watch")) {
    const context = await esbuild.context(options);
    await context.watch();
  } else {
    await esbuild.build(options);
  }
  // A static build must never contain the explorer implementation or cached entries.
  const publicJs = path.join(project, "build", "static", "js");
  if (process.argv.includes("--check-public") && fs.existsSync(publicJs)) {
    for (const file of fs.readdirSync(publicJs)) {
      if (!file.endsWith(".js") && !file.endsWith(".map")) continue;
      const content = fs.readFileSync(path.join(publicJs, file), "utf8");
      if (content.includes("rabbit-hole-web-v1") || content.includes("freedictionaryapi.com/api/v1/entries")) {
        throw new Error("Word Web implementation leaked into the public build. Remove public imports of src/WordWeb.");
      }
      if (file.endsWith(".js") && content.includes("/__word-web-development")) {
        throw new Error("The local development bypass must not appear in the production browser bundle.");
      }
    }
  }
}
main().catch(() => { console.error("Private Word Web build or isolation check failed."); process.exitCode = 1; });
