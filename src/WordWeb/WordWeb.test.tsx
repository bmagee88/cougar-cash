import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import WordWeb from "./WordWeb";
import { VocabularyGraph } from "./graph";
import { STARTER_ENTRIES } from "./starterEntries";
declare const test: any, expect: any, beforeAll: any, beforeEach: any, jest: any;

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }: any) => require("react").createElement("a", { href: to, ...props }, children),
}), { virtual: true });

beforeAll(() => {
  global.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  if (!global.PointerEvent) global.PointerEvent = class extends MouseEvent {
    pointerId: number; pointerType: string; isPrimary: boolean;
    constructor(type: string, options: PointerEventInit = {}) {
      super(type, options); this.pointerId = options.pointerId ?? 1;
      this.pointerType = options.pointerType || "mouse"; this.isPrimary = options.isPrimary ?? true;
    }
  } as any;
});
beforeEach(() => localStorage.clear());
const renderApp = () => render(<WordWeb />);
const activateCanvasWord = (word: string) => {
  const button = screen.getByRole("button", { name: `Inspect ${word}` });
  fireEvent.click(button); fireEvent.click(button);
};

function preparePanWeb() {
  const make = (word: string, definition: string) => ({ ...STARTER_ENTRIES[0], word, forms: [], synonyms: [], antonyms: [], meanings: [{ partOfSpeech: "noun", definition }] });
  const graph = new VocabularyGraph(make("root", "Alpha and beta."));
  graph.explore(make("alpha", "A beta."), "definition");
  graph.explore(make("beta", "A root."), "definition");
  graph.backtrack("root");
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
}

const cameraValues = (world: HTMLElement) => world.style.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\) scale\(([\d.]+)\)/)!.slice(1).map(Number);

test("stop words remain plain text, including capitals and contractions, while vocabulary and phrases stay clickable", () => {
  const definition = "A reason to not hesitate, and it isn’t the end.";
  const graph = new VocabularyGraph({ ...STARTER_ENTRIES[0],
    meanings: [{ partOfSpeech: "noun", definition }], synonyms: ["a", "not at all"], antonyms: ["not"],
  });
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
  renderApp();
  const card = screen.getByRole("article", { name: "Definition of curiosity" });
  expect(card).toHaveTextContent(definition);
  ["A", "to", "not", "and", "it", "isn’t", "the"].forEach(word => {
    expect(within(card).queryByRole("button", { name: `Explore ${word}` })).not.toBeInTheDocument();
  });
  expect(within(card).queryByRole("button", { name: "Explore synonym a" })).not.toBeInTheDocument();
  expect(within(card).queryByRole("button", { name: "Explore antonym not" })).not.toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "Explore reason" })).toBeEnabled();
  expect(within(card).getByRole("button", { name: "Explore hesitate" })).toBeEnabled();
  expect(within(card).getByRole("button", { name: "Explore synonym not at all" })).toBeEnabled();
});

test("definition words grow a connected web and backtracking walks the existing edge", async () => {
  renderApp();
  expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Explore learn" })[0]);
  await screen.findByRole("article", { name: "Definition of learn" });
  expect(screen.getByRole("button", { name: "Inspect curiosity" })).toBeEnabled();
  expect(screen.getByLabelText("Your walking trail")).toHaveTextContent("curiosity/learn");
  fireEvent.click(screen.getByRole("button", { name: "Go back one connection" }));
  expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
  const saved = JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!);
  expect(saved.nodes).toHaveLength(2);
  expect(saved.edges.every((edge: any) => edge.traversed)).toBe(true);
  expect(saved.walk).toEqual(["curiosity"]);
});

test("synonyms and antonyms can be followed and persist after remount", async () => {
  const { unmount } = renderApp();
  fireEvent.click(screen.getByRole("button", { name: "Explore antonym ignorance" }));
  await screen.findByRole("article", { name: "Definition of ignorance" });
  const saved = JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!);
  expect(saved.edges).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "antonym", traversed: true })]));
  unmount(); renderApp();
  expect(screen.getByRole("article", { name: "Definition of ignorance" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inspect curiosity" })).toBeEnabled();
});

test("focus changes pan one world layer without changing word coordinates or line paths", async () => {
  const { container } = renderApp();
  fireEvent.click(screen.getByRole("button", { name: "Explore learn" }));
  await screen.findByRole("article", { name: "Definition of learn" });
  const world = container.querySelector<HTMLElement>(".rh-world")!;
  const transform = world.style.transform;
  const coordinates = Array.from(world.querySelectorAll<HTMLElement>(".rh-node")).map(node => [node.textContent, node.style.left, node.style.top]);
  const paths = Array.from(world.querySelectorAll(".rh-edge-line")).map(path => path.getAttribute("d"));
  fireEvent.click(screen.getByRole("button", { name: "Go back one connection" }));
  expect(world.style.transform).not.toBe(transform);
  expect(Array.from(world.querySelectorAll<HTMLElement>(".rh-node")).map(node => [node.textContent, node.style.left, node.style.top])).toEqual(coordinates);
  expect(Array.from(world.querySelectorAll(".rh-edge-line")).map(path => path.getAttribute("d"))).toEqual(paths);
  expect(world.querySelectorAll(".rh-node")).toHaveLength(2);
});

test("a new web requires a valid lookup and replaces the trail only after success", async () => {
  renderApp();
  fireEvent.click(screen.getByRole("button", { name: "New web" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Starting word"), { target: { value: "interest" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Begin" }));
  await screen.findByRole("article", { name: "Definition of interest" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Go back one connection" })).toBeDisabled();
});

test("a failed dictionary lookup keeps the current web and offers a working retry", async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockRejectedValue(new Error("offline"));
  global.fetch = fetchMock;
  try {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Explore investigating" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("article", { name: "Definition of curiosity" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!).nodes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await screen.findByRole("alert");
  } finally { global.fetch = originalFetch; }
});

test("clicking plural and singular spellings opens the same base-word node", async () => {
  const original = global.fetch;
  const fetchMock = jest.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ entries: [{ partOfSpeech: "noun",
    forms: url.endsWith("/sugar") ? [{ word: "sugars", tags: ["plural"] }] : [],
    senses: [{ definition: url.endsWith("/sugars") ? "plural of sugar" : "Sweet crystals." }],
  }] }) }));
  global.fetch = fetchMock as any;
  const graph = new VocabularyGraph({ ...STARTER_ENTRIES[0], meanings: [{ partOfSpeech: "noun", definition: "Sugars and sugar." }] });
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
  try {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Explore Sugars" }));
    await screen.findByRole("article", { name: "Definition of sugar" });
    expect(screen.getByRole("article")).toHaveTextContent("Sweet crystals.");
    fireEvent.click(screen.getByRole("button", { name: "Go back one connection" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore sugar" }));
    await screen.findByRole("article", { name: "Definition of sugar" });
    const saved = JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!);
    expect(saved.nodes.map((node: any) => node.id)).toEqual(["curiosity", "sugar"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally { global.fetch = original; }
});

test("old saved duplicate forms are merged on opening the app", () => {
  const original = { ...STARTER_ENTRIES[0], meanings: [{ partOfSpeech: "noun", definition: "Sugars and sugar." }] };
  const graph = new VocabularyGraph(original);
  graph.explore({ ...original, word: "sugars", meanings: [{ partOfSpeech: "noun", definition: "plural of sugar" }] }, "definition");
  graph.explore({ ...original, word: "sugar", meanings: [{ partOfSpeech: "noun", definition: "Sweet crystals." }] }, "definition");
  graph.backtrack(); graph.backtrack();
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
  const { container } = renderApp();
  expect(container.querySelectorAll(".rh-node")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Inspect sugar" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Inspect sugars" })).not.toBeInTheDocument();
});

test("trail references and lines stay locked while blue canvas words backtrack without API calls", () => {
  const root = { ...STARTER_ENTRIES[0], word: "run", forms: ["ran", "running"],
    meanings: [{ partOfSpeech: "verb", definition: "Follow a branch." }], synonyms: [], antonyms: [] };
  const graph = new VocabularyGraph(root);
  graph.explore({ ...root, word: "branch", forms: [], meanings: [{ partOfSpeech: "noun", definition: "Running and run along a leaf." }], synonyms: ["ran"], antonyms: ["run"] }, "definition");
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
  const original = global.fetch, fetchMock = jest.fn(); global.fetch = fetchMock;
  try {
    const { container } = renderApp();
    ["Explore Running", "Explore run", "Explore synonym ran", "Explore antonym run"].forEach(name => {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled(); fireEvent.click(button);
    });
    screen.getAllByRole("button", { name: /Follow .* connection to run/ }).forEach(path => {
      expect(path).toHaveAttribute("aria-disabled", "true");
      expect(path).toHaveAttribute("tabindex", "-1");
      fireEvent.click(path);
    });
    expect(container.querySelectorAll(".rh-edge.is-blocked")).toHaveLength(3);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".rh-edge-trail-glow")).toHaveLength(1);
    const blueWord = screen.getByRole("button", { name: "Inspect run" });
    expect(blueWord).toBeEnabled(); fireEvent.click(blueWord);
    expect(blueWord).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("article", { name: "Definition of branch" })).toBeInTheDocument();
    fireEvent.click(blueWord);
    expect(screen.getByRole("article", { name: "Definition of run" })).toBeInTheDocument();
    expect(container.querySelectorAll(".rh-edge-trail-glow")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Inspect branch" })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { global.fetch = original; }
});

test("the full scrollable trail allows jumping back and replacing the end with a new branch", async () => {
  const make = (word: string, definition: string) => ({ ...STARTER_ENTRIES[0], word, forms: [], synonyms: [], antonyms: [], meanings: [{ partOfSpeech: "noun", definition }] });
  const graph = new VocabularyGraph(make("root", "Alpha and a tangent."));
  ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].forEach((word, index, list) => graph.explore(make(word, `${list[index + 1] || "Root"} and root.`), "definition"));
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
  const { container } = renderApp();
  const trail = screen.getByLabelText("Your walking trail");
  expect(within(trail).getAllByRole("button")).toHaveLength(7);
  expect(within(trail).getByRole("button", { name: "Backtrack to root" })).toBeEnabled();
  expect(within(trail).getByRole("button", { name: "Backtrack to zeta" })).toHaveAttribute("aria-current", "step");
  activateCanvasWord("gamma");
  expect(screen.getByRole("article", { name: "Definition of gamma" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!).walk).toEqual(["root", "alpha", "beta", "gamma"]);
  expect(within(trail).queryByRole("button", { name: "Backtrack to delta" })).not.toBeInTheDocument();
  expect(container.querySelectorAll(".rh-edge-trail-glow")).toHaveLength(3);
  activateCanvasWord("delta");
  expect(JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!).walk).toEqual(["root", "alpha", "beta", "gamma", "delta"]);
  fireEvent.click(within(trail).getByRole("button", { name: "Backtrack to root" }));
  activateCanvasWord("zeta");
  expect(JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!).walk).toEqual(["root", "zeta"]);
  expect(screen.getByRole("button", { name: "Inspect epsilon" })).toBeEnabled();
});

test("the path limit blocks every forward control, preserves unique walked counts, and allows an independent new web", async () => {
  const make = (word: string, definition: string) => ({ ...STARTER_ENTRIES[0], word, forms: [], synonyms: [], antonyms: [], meanings: [{ partOfSpeech: "noun", definition }] });
  const graph = new VocabularyGraph(make("root", "Alpha and gamma."));
  graph.explore(make("alpha", "A beta."), "definition");
  graph.explore({ ...make("beta", "Root gamma and novel."), synonyms: ["unknown"], antonyms: ["absent"] }, "definition");
  graph.backtrack("root"); graph.explore(make("gamma", "A beta."), "definition");
  graph.backtrack("root"); graph.traverse("alpha"); graph.traverse("beta");
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(graph.snapshot()));
  const original = global.fetch, fetchMock = jest.fn(); global.fetch = fetchMock;
  try {
    renderApp();
    expect(screen.getByText("Trail limit reached")).toBeInTheDocument();
    const stats = screen.getByLabelText("Web statistics");
    expect(within(stats).getByText("connections walked").parentElement).toHaveTextContent("3 / 5");
    ["Explore gamma", "Explore novel", "Explore synonym unknown", "Explore antonym absent"].forEach(name => {
      const button = screen.getByRole("button", { name }); expect(button).toBeDisabled(); fireEvent.click(button);
    });
    const connection = screen.getByRole("button", { name: "Follow definition connection to gamma" });
    expect(connection).toHaveAttribute("aria-disabled", "true"); fireEvent.click(connection);
    expect(fetchMock).not.toHaveBeenCalled();
    const original = JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!);
    fireEvent.click(screen.getByRole("button", { name: "Minimize current word" }));
    activateCanvasWord("root");
    expect(screen.getByRole("article", { name: "Definition of root" })).toBeVisible();
    const backtracked = JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!);
    expect(backtracked.walk).toEqual(["root"]);
    expect(backtracked.nodes).toEqual(original.nodes); expect(backtracked.edges).toEqual(original.edges);
    expect(screen.queryByText("Trail limit reached")).not.toBeInTheDocument();
    activateCanvasWord("gamma");
    expect(within(stats).getByText("connections walked").parentElement).toHaveTextContent("3 / 5");
    activateCanvasWord("beta");
    expect(within(stats).getByText("connections walked").parentElement).toHaveTextContent("4 / 5");
    expect(screen.getByText("Trail limit reached")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New web" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Starting word"), { target: { value: "curiosity" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Begin" }));
    await screen.findByRole("article", { name: "Definition of curiosity" });
    expect(screen.queryByText("Trail limit reached")).not.toBeInTheDocument();
    expect(within(screen.getByRole("article")).getAllByRole("button", { name: /^Explore / }).some(button => !button.hasAttribute("disabled"))).toBe(true);
    expect(within(stats).getByText("connections walked").parentElement).toHaveTextContent("0 / 0");
    expect(JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!).nodes).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { global.fetch = original; }
});

test("minimizing docks the current word and dragging pans the fixed web without following a connection", () => {
  preparePanWeb();
  const saved = localStorage.getItem("rabbit-hole-web-v1");
  const original = global.fetch, fetchMock = jest.fn(); global.fetch = fetchMock;
  try {
    const { container } = renderApp();
    const stage = screen.getByLabelText("Word connection web"), world = container.querySelector<HTMLElement>(".rh-world")!;
    const before = cameraValues(world);
    const coordinates = Array.from(world.querySelectorAll<HTMLElement>(".rh-node")).map(node => [node.style.left, node.style.top]);
    const paths = Array.from(world.querySelectorAll(".rh-edge-line")).map(path => path.getAttribute("d"));
    fireEvent.click(screen.getByRole("button", { name: "Minimize current word" }));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore current word root" })).toHaveTextContent("root");
    expect(screen.getByRole("button", { name: "Inspect current word root" })).toBeVisible();
    const node = screen.getByRole("button", { name: "Inspect alpha" });
    stage.setPointerCapture = jest.fn(); stage.hasPointerCapture = jest.fn(() => true); stage.releasePointerCapture = jest.fn();
    fireEvent.pointerDown(node, { pointerId: 13, clientX: 100, clientY: 100, button: 0, buttons: 1 });
    fireEvent.pointerMove(stage, { pointerId: 13, clientX: 220, clientY: 160, buttons: 1 });
    expect(stage.setPointerCapture).toHaveBeenCalledWith(13);
    const after = cameraValues(world);
    expect(after[0] - before[0]).toBeCloseTo(120); expect(after[1] - before[1]).toBeCloseTo(60);
    fireEvent.pointerUp(stage, { pointerId: 13, clientX: 220, clientY: 160 });
    fireEvent.click(node, { detail: 1 });
    expect(screen.getByRole("button", { name: "Restore current word root" })).toBeInTheDocument();
    expect(Array.from(world.querySelectorAll<HTMLElement>(".rh-node")).map(node => [node.style.left, node.style.top])).toEqual(coordinates);
    expect(Array.from(world.querySelectorAll(".rh-edge-line")).map(path => path.getAttribute("d"))).toEqual(paths);
    expect(localStorage.getItem("rabbit-hole-web-v1")).toBe(saved);
    const center = [(600 - after[0]) / after[2], (360 - after[1]) / after[2]];
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const zoomed = cameraValues(world);
    expect((600 - zoomed[0]) / zoomed[2]).toBeCloseTo(center[0]);
    expect((360 - zoomed[1]) / zoomed[2]).toBeCloseTo(center[1]);
    fireEvent.click(screen.getByRole("button", { name: "Restore current word root" }));
    expect(screen.getByRole("article", { name: "Definition of root" })).toBeVisible();
    expect(cameraValues(world).slice(0, 2)).toEqual([600, 360]);
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { global.fetch = original; }
});

test("cancelled touch pans release the gesture and a short click can still follow an allowed word", () => {
  preparePanWeb();
  const { container } = renderApp();
  const stage = screen.getByLabelText("Word connection web"), world = container.querySelector<HTMLElement>(".rh-world")!;
  const before = world.style.transform;
  fireEvent.pointerDown(stage, { clientX: 30, clientY: 30, button: 0, buttons: 1 });
  fireEvent.pointerMove(stage, { clientX: 90, clientY: 90, buttons: 1 });
  expect(world.style.transform).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Minimize current word" }));
  fireEvent.pointerDown(stage, { pointerId: 2, pointerType: "touch", clientX: 30, clientY: 30, button: 0, buttons: 1 });
  fireEvent.pointerMove(stage, { pointerId: 2, pointerType: "touch", clientX: 80, clientY: 70, buttons: 1 });
  expect(stage).toHaveClass("is-dragging");
  fireEvent.pointerCancel(stage, { pointerId: 2, pointerType: "touch" });
  expect(stage).not.toHaveClass("is-dragging");
  const cancelled = world.style.transform;
  fireEvent.pointerMove(stage, { pointerId: 2, pointerType: "touch", clientX: 190, clientY: 190, buttons: 1 });
  expect(world.style.transform).toBe(cancelled);
  const node = screen.getByRole("button", { name: "Inspect alpha" });
  fireEvent.pointerDown(node, { pointerId: 3, clientX: 100, clientY: 100, button: 0, buttons: 1 });
  fireEvent.pointerMove(stage, { pointerId: 3, clientX: 102, clientY: 102, buttons: 1 });
  fireEvent.pointerUp(node, { pointerId: 3, clientX: 102, clientY: 102 });
  fireEvent.click(node, { detail: 1 });
  expect(screen.getByRole("button", { name: "Restore current word root" })).toBeInTheDocument();
  expect(node).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(node, { detail: 1 });
  expect(screen.getByRole("article", { name: "Definition of alpha" })).toBeVisible();
  expect(screen.getByLabelText("Your walking trail")).toHaveTextContent("root/alpha");
  expect(stage).not.toHaveClass("is-pannable");
});

test("keyboard panning, fit, and Escape allow inspecting and returning to the centered definition", () => {
  preparePanWeb();
  const { container } = renderApp();
  const stage = screen.getByLabelText("Word connection web"), world = container.querySelector<HTMLElement>(".rh-world")!;
  fireEvent.click(screen.getByRole("button", { name: "Minimize current word" }));
  fireEvent.keyDown(stage, { key: "ArrowRight" }); fireEvent.keyDown(stage, { key: "ArrowDown" });
  expect(cameraValues(world).slice(0, 2)).toEqual([540, 300]);
  fireEvent.click(screen.getByRole("button", { name: "Fit web in view" }));
  expect(cameraValues(world).slice(0, 2)).toEqual([600, 360]);
  expect(screen.getByRole("button", { name: "Restore current word root" })).toBeInTheDocument();
  fireEvent.keyDown(stage, { key: "ArrowLeft" });
  expect(cameraValues(world)[0]).toBeCloseTo(660);
  fireEvent.keyDown(stage, { key: "Escape" });
  expect(screen.getByRole("article", { name: "Definition of root" })).toBeVisible();
  expect(cameraValues(world).slice(0, 2)).toEqual([600, 360]);
});

test("one click inspects every relationship without moving, and a second blue-word click backtracks", () => {
  const make = (word: string, definition: string) => ({ ...STARTER_ENTRIES[0], word, forms: [], synonyms: [], antonyms: [], meanings: [{ partOfSpeech: "noun", definition }] });
  const graph = new VocabularyGraph(make("root", "Alpha and gamma."));
  graph.explore(make("alpha", "A beta."), "definition"); graph.explore(make("beta", "A leaf."), "definition");
  graph.backtrack("root");
  graph.explore({ ...make("gamma", "A delta."), synonyms: ["root"], antonyms: ["alpha"] }, "definition");
  graph.explore(make("delta", "A leaf."), "definition");
  graph.backtrack("root"); graph.traverse("alpha"); graph.traverse("beta");
  const before = graph.snapshot();
  localStorage.setItem("rabbit-hole-web-v1", JSON.stringify(before));
  const original = global.fetch, fetchMock = jest.fn(); global.fetch = fetchMock;
  try {
    const { container } = renderApp();
    const saved = localStorage.getItem("rabbit-hole-web-v1"), world = container.querySelector<HTMLElement>(".rh-world")!;
    const camera = world.style.transform;
    const gamma = screen.getByRole("button", { name: "Inspect gamma" });
    expect(gamma).toBeEnabled(); fireEvent.click(gamma);
    expect(gamma).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".rh-edge.is-selected-connection")).toHaveLength(4);
    expect(Array.from(container.querySelectorAll(".rh-node.is-selection-neighbor")).map(node => node.textContent).sort()).toEqual(["alpha", "delta", "root"]);
    expect(screen.getByRole("article", { name: "Definition of beta" })).toBeVisible();
    expect(world.style.transform).toBe(camera); expect(localStorage.getItem("rabbit-hole-web-v1")).toBe(saved);
    fireEvent.click(gamma);
    expect(localStorage.getItem("rabbit-hole-web-v1")).toBe(saved);
    fireEvent.click(screen.getByLabelText("Word connection web"));
    expect(container.querySelectorAll(".rh-edge.is-selected-connection")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Minimize current word" }));
    const blue = screen.getByRole("button", { name: "Inspect root" });
    fireEvent.click(blue);
    expect(blue).toHaveClass("is-on-trail", "is-selected");
    expect(screen.getByRole("button", { name: "Restore current word beta" })).toBeInTheDocument();
    expect(localStorage.getItem("rabbit-hole-web-v1")).toBe(saved);
    fireEvent.click(blue);
    const after = JSON.parse(localStorage.getItem("rabbit-hole-web-v1")!);
    expect(after.walk).toEqual(["root"]); expect(after.nodes).toEqual(before.nodes); expect(after.edges).toEqual(before.edges);
    expect(screen.getByRole("article", { name: "Definition of root" })).toBeVisible();
    expect(container.querySelectorAll(".rh-edge.is-selected-connection")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { global.fetch = original; }
});
