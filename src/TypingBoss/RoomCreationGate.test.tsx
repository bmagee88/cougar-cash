import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoomCreationGate from "./RoomCreationGate";
import { unlockTypingBossCreation } from "./api";

declare const test: any, expect: any, jest: any;
jest.mock("./api");

test("password stays hidden, displays two dots per character, and unlocks only after server approval", async () => {
  const unlock = unlockTypingBossCreation as any;
  unlock.mockResolvedValueOnce({ allowed: true });
  render(<RoomCreationGate>{password => <div>Creation unlocked {password.length}</div>}</RoomCreationGate>);
  expect(screen.queryByText(/Creation unlocked/)).toBeNull();
  const field = screen.getByLabelText("Password");
  expect(field.getAttribute("type")).toBe("password");
  fireEvent.change(field, { target: { value: "abcde" } });
  expect(screen.getByTestId("creation-password-mask").textContent).toBe("•".repeat(10));
  fireEvent.change(field, { target: { value: "abc" } });
  expect(screen.getByTestId("creation-password-mask").textContent).toBe("•".repeat(6));
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await waitFor(() => expect(screen.getByText("Creation unlocked 3")).toBeTruthy());
  expect(unlock).toHaveBeenLastCalledWith("abc");
});

test("incorrect passwords keep the creation form locked", async () => {
  (unlockTypingBossCreation as any).mockRejectedValueOnce(new Error("Incorrect room creation password."));
  render(<RoomCreationGate>{() => <div>Creation unlocked</div>}</RoomCreationGate>);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Incorrect"));
  expect(screen.queryByText("Creation unlocked")).toBeNull();
});
