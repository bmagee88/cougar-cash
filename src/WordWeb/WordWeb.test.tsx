// Jest globals follow the existing Cougar Cash test setup.
declare const test: any, expect: any, jest: any, beforeAll: any, beforeEach: any, afterEach: any;
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import WordWeb from "./WordWeb";
import { STARTER_ENTRIES } from "./starterEntries";
import { VocabularyGraph } from "./graph";

const STORAGE_KEY = "word-web-student-web-v1";
const originalFetch = global.fetch;
beforeAll(() => {
  global.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { global.fetch = originalFetch; });

test("preserves exploration, backtracking, moods, map controls and browser persistence", async () => {
  const app = render(<WordWeb />);
  expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
  expect(app.container.querySelector(".rh-attribution")).toHaveTextContent("Word Web starter vocabulary");
  fireEvent.click(screen.getByRole("button", { name: "Explore synonym interest" }));
  await screen.findByRole("article", { name: "Definition of interest" });
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).walk).toEqual(["curiosity", "interest"]);
  fireEvent.click(screen.getByRole("button", { name: "Go back one connection" }));
  expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  const moods = screen.getByRole("group", { name: "Mood" });
  expect(within(moods).getAllByRole("button")).toHaveLength(7);
  fireEvent.click(within(moods).getByRole("button", { name: "Ocean mood" }));
  expect(app.container.querySelector(".rh-app")).toHaveAttribute("data-mood", "Ocean");
  fireEvent.click(screen.getByRole("button", { name: "Minimize current word" }));
  expect(screen.queryByRole("article", { name: "Definition of curiosity" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Fit web in view" })).toBeInTheDocument();
  app.unmount();
  const restored = render(<WordWeb />);
  expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
  expect(restored.container.querySelector(".rh-app")).toHaveAttribute("data-mood", "Ocean");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).nodes).toHaveLength(2);
});

test("missing API key gives a child-friendly message and preserves the current graph", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503,
    headers: { get: () => "application/json" }, json: async () => ({ code: "configuration" }) });
  render(<WordWeb />);
  const saved = localStorage.getItem(STORAGE_KEY);
  fireEvent.click(screen.getByRole("button", { name: "Explore things" }));
  await screen.findByText(/student dictionary is not set up yet/);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
});

test("unrestricted saved content is rejected before rendering", () => {
  const snapshot = new VocabularyGraph(STARTER_ENTRIES[0]).snapshot();
  snapshot.nodes[0].entry = { ...snapshot.nodes[0].entry, sourceName: "Unrestricted dictionary",
    meanings: [{ partOfSpeech: "noun", definition: "SHOULD NEVER BE VISIBLE" }] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  render(<WordWeb />);
  expect(screen.queryByText("SHOULD NEVER BE VISIBLE")).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
});

test("importing an unrestricted Rabbit Hole export leaves the current web intact", async () => {
  render(<WordWeb />);
  fireEvent.click(screen.getByRole("button", { name: "Menu" }));
  const saved = localStorage.getItem(STORAGE_KEY);
  const oldWeb = new VocabularyGraph(STARTER_ENTRIES[0]).snapshot();
  oldWeb.nodes[0].entry = { ...oldWeb.nodes[0].entry, studentPolicy: undefined, sourceName: "Old dictionary" };
  fireEvent.change(screen.getByLabelText("Import a saved web"), {
    target: { files: [{ text: async () => JSON.stringify(oldWeb) }] },
  });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Only student Word Web files"));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
});
