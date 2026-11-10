import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import WordFilterChips, { WordFilters } from "./WordFilterChips";
declare const test: any, expect: any;

function Harness() {
  const [value, setValue] = useState<WordFilters>({});
  return <WordFilterChips value={value} onChange={setValue} />;
}
test("All selects and disables individuals; turning it off enables independent checkboxes", () => {
  render(<Harness />);
  const grades = within(screen.getByRole("group", {name:"Word grades"}));
  const sentiments = within(screen.getByRole("group", {name:"Word sentiment"}));
  expect(grades.getByRole("checkbox", {name:"All"}).getAttribute("aria-checked")).toBe("true");
  expect(grades.getByRole("checkbox", {name:"Kindergarten"}).getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(grades.getByRole("checkbox", {name:"All"}));
  fireEvent.click(grades.getByRole("checkbox", {name:"Grade 1"}));
  expect(grades.getByRole("checkbox", {name:"Grade 1"}).getAttribute("aria-checked")).toBe("false");
  expect(grades.getByRole("checkbox", {name:"Kindergarten"}).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(sentiments.getByRole("checkbox", {name:"All"}));
  fireEvent.click(sentiments.getByRole("checkbox", {name:"Neutral"}));
  expect(sentiments.getByRole("checkbox", {name:"Positive"}).getAttribute("aria-checked")).toBe("true");
  expect(sentiments.getByRole("checkbox", {name:"Negative"}).getAttribute("aria-checked")).toBe("true");
  expect(sentiments.getByRole("checkbox", {name:"Neutral"}).getAttribute("aria-checked")).toBe("false");
  fireEvent.click(sentiments.getByRole("checkbox", {name:"All"}));
  expect(sentiments.getByRole("checkbox", {name:"Neutral"}).getAttribute("aria-disabled")).toBe("true");
});

test("empty grade/sentiment intersections explain why play is unavailable", () => {
  render(<WordFilterChips value={{gradeMask:256, sentimentMask:2}} onChange={() => {}} />);
  expect(screen.getByRole("alert").textContent).toContain("No words match");
});
