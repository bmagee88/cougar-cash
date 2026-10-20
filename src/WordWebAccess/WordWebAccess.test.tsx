import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WordWebAccess from "./WordWebAccess";

declare const test: any, expect: any, beforeEach: any, jest: any;

let googleCallback: (result: { credential: string }) => void;
const fetchMock = jest.fn();
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, headers: { get: () => "application/json" }, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(response({ clientId: "google-client", nonce: "fresh-page-nonce" }));
  window.fetch = fetchMock;
  (window as any).google = { accounts: { id: {
    initialize: jest.fn(options => { googleCallback = options.callback; }),
    renderButton: jest.fn(), cancel: jest.fn(),
  } } };
  URL.createObjectURL = jest.fn(() => "blob:test-private-bundle");
  URL.revokeObjectURL = jest.fn();
});

async function fillForm() {
  await waitFor(() => expect((window as any).google.accounts.id.initialize).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Email", { exact: true }), { target: { value: "person@example.test" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "test-only-password" } });
  act(() => googleCallback({ credential: "google-credential" }));
}

test("always starts locked without reading or changing the saved web", async () => {
  localStorage.setItem("rabbit-hole-web-v1", "saved-private-graph");
  localStorage.setItem("word-web-unlocked", "true");
  const app = render(<WordWebAccess />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("heading", { name: "A world of words awaits." })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Word Web" }).hasAttribute("disabled")).toBe(true);
  expect(document.getElementById("word-web-private-root")?.hidden).toBe(true);
  expect(document.querySelector('script[src^="blob:"]')).toBeNull();
  expect(localStorage.getItem("rabbit-hole-web-v1")).toBe("saved-private-graph");
  app.unmount();
  render(<WordWebAccess />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(document.getElementById("word-web-private-root")?.hidden).toBe(true);
});

test("server rejection keeps code unavailable and clears the entered password", async () => {
  render(<WordWebAccess />);
  await fillForm();
  fetchMock.mockResolvedValueOnce(response({ error: "Access denied." }, 403));
  fireEvent.click(screen.getByRole("button", { name: "Open Word Web" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("");
  expect(document.querySelector('script[src^="blob:"]')).toBeNull();
  expect(document.getElementById("word-web-private-root")?.hidden).toBe(true);
  const [, options] = fetchMock.mock.calls[1];
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toEqual({ email: "person@example.test", password: "test-only-password", credential: "google-credential" });
});

test("only a successful server bundle opens the app, and leaving removes it", async () => {
  const app = render(<WordWebAccess />);
  await fillForm();
  fetchMock.mockResolvedValueOnce(response({ script: "private code", css: ".test-private-style {}" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Word Web" }));
  await waitFor(() => expect(document.querySelector('script[src="blob:test-private-bundle"]')).toBeTruthy());
  const script = document.querySelector('script[src="blob:test-private-bundle"]')!;
  act(() => { script.dispatchEvent(new Event("load")); });
  await waitFor(() => expect(document.getElementById("word-web-private-root")?.hidden).toBe(false));
  expect(screen.queryByRole("heading", { name: "A world of words awaits." })).toBeNull();
  const lock = jest.fn();
  window.addEventListener("word-web:lock", lock, { once: true });
  app.unmount();
  expect(lock).toHaveBeenCalledTimes(1);
  expect(document.querySelector('script[src="blob:test-private-bundle"]')).toBeNull();
  expect(Array.from(document.querySelectorAll("style")).some(style => style.textContent?.includes("test-private-style"))).toBe(false);
  render(<WordWebAccess />);
  await screen.findByRole("heading", { name: "A world of words awaits." });
  expect(document.getElementById("word-web-private-root")?.hidden).toBe(true);
});

test("editing email requires selecting a Google account again", async () => {
  render(<WordWebAccess />);
  await fillForm();
  expect(screen.getByRole("button", { name: "Open Word Web" }).hasAttribute("disabled")).toBe(false);
  fireEvent.change(screen.getByLabelText("Email", { exact: true }), { target: { value: "different@example.test" } });
  expect(screen.getByRole("button", { name: "Open Word Web" }).hasAttribute("disabled")).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("development opens the app automatically without email, password, or Google sign-in", async () => {
  const previous = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "development";
  fetchMock.mockResolvedValueOnce(response({ script: "private code", css: ".dev-only-style {}" }));
  const app = render(<WordWebAccess />);
  try {
    expect(screen.queryByLabelText("Email", { exact: true })).toBeNull();
    expect(screen.queryByLabelText("Password", { exact: true })).toBeNull();
    await waitFor(() => expect(document.querySelector('script[src="blob:test-private-bundle"]')).toBeTruthy());
    act(() => { document.querySelector('script[src="blob:test-private-bundle"]')!.dispatchEvent(new Event("load")); });
    await waitFor(() => expect(document.getElementById("word-web-private-root")?.hidden).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/__word-web-development");
    expect((window as any).google.accounts.id.initialize).not.toHaveBeenCalled();
  } finally { app.unmount(); (process.env as any).NODE_ENV = previous; }
});

test("development loading errors offer retry without falling back to Google login", async () => {
  const previous = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "development";
  fetchMock.mockResolvedValueOnce(response({ error: "Build Word Web, then retry." }, 503));
  const app = render(<WordWebAccess />);
  try {
    expect((await screen.findByRole("alert")).textContent).toContain("Build Word Web, then retry.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(document.getElementById("word-web-private-root")?.hidden).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((window as any).google.accounts.id.initialize).not.toHaveBeenCalled();
  } finally { app.unmount(); (process.env as any).NODE_ENV = previous; }
});
