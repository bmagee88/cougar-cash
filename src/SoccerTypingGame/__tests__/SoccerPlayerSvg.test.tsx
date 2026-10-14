import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SoccerPlayerSvg from "../components/SoccerPlayerSvg";
import SoccerGoalkeeperSvg from "../components/SoccerGoalkeeperSvg";
import SoccerGoalkeeperDiveSvg from "../components/SoccerGoalkeeperDiveSvg";

declare const test: (name: string, fn: () => void) => void;
declare const expect: any;

function parseSvg(element: React.ReactElement) {
  return new DOMParser().parseFromString(renderToStaticMarkup(element), "image/svg+xml");
}

test("custom player colors update the artwork while retaining its geometry and other colors", () => {
  const colors = {
    shirt: "#e11d48",
    shorts: "#e2e8f0",
    socks: "#2563eb",
    trim: "#fbbf24",
    skin: "#b8754c",
    hair: "#60452b",
    boots: "#111827",
  };
  const artwork = parseSvg(<SoccerPlayerSvg colors={colors} />);
  const geometry = Array.from(artwork.querySelectorAll("path"), (path) => path.getAttribute("d"));
  const renderedColors = Array.from(artwork.querySelectorAll("path")).flatMap((path) => [
    path.getAttribute("fill"),
    path.getAttribute("stroke"),
  ]);
  Object.values(colors).forEach((color) => expect(renderedColors).toContain(color));

  const updated = parseSvg(<SoccerPlayerSvg colors={{ ...colors, shirt: "#a855f7" }} />);

  expect(updated.querySelector('[fill="#e11d48"]')).toBeNull();
  expect(updated.querySelector('[fill="#a855f7"]')).not.toBeNull();
  expect(updated.querySelector('[fill="#111827"]')).not.toBeNull();
  expect(Array.from(updated.querySelectorAll("path"), (path) => path.getAttribute("d"))).toEqual(geometry);
});

test("all four goalkeeper dive poses preserve custom kit and glove colors", () => {
  for (const location of ["tl", "tr", "bl", "br"] as const) {
    const artwork = parseSvg(<SoccerGoalkeeperDiveSvg location={location} colors={{ shirt: "#ef4444", shorts: "#111827", gloves: "#fbbf24" }} />);
    expect(artwork.querySelector("svg")!.getAttribute("data-dive")).toBe(location);
    expect(artwork.querySelector('[fill="#ef4444"]')).not.toBeNull();
    expect(artwork.querySelector('[fill="#111827"]')).not.toBeNull();
    expect(artwork.querySelector('[fill="#fbbf24"]')).not.toBeNull();
  }
});

test("goalkeeper kits and gloves can be customized independently", () => {
  const colors = { shirt: "#ef4444", shorts: "#111827", gloves: "#fbbf24" };
  const artwork = parseSvg(<SoccerGoalkeeperSvg colors={colors} />);
  expect(artwork.querySelector('[fill="#ef4444"]')).not.toBeNull();
  expect(artwork.querySelector('[fill="#111827"]')).not.toBeNull();
  expect(artwork.querySelectorAll('[fill="#fbbf24"]')).toHaveLength(1);
  const updated = parseSvg(<SoccerGoalkeeperSvg colors={{ ...colors, gloves: "#e2e8f0" }} />);
  expect(updated.querySelector('[fill="#fbbf24"]')).toBeNull();
  expect(updated.querySelector('[fill="#e2e8f0"]')).not.toBeNull();
  expect(updated.querySelector('[fill="#ef4444"]')).not.toBeNull();
});
