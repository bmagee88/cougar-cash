const fs = require("fs");
const path = require("path");

test("registers the Vocabulary Shadow Boxing route", () => {
  const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
  expect(source).toContain('/games/vocab/shadow-boxing');
});

test("registers the Soccer Typing route", () => {
  const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
  expect(source).toContain("/typing/soccer");
  expect(source).toContain("SoccerTypingGame");
});
