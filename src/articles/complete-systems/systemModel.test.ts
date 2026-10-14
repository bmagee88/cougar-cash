import { describe, expect, it } from "@jest/globals";
import { getRecordingResult, getWeatherResult } from "./systemModel";

describe("recording system", () => {
  it("distinguishes missing input, a different source, and an unsaved file", () => {
    expect(getRecordingResult({ microphoneConnected: false })).toMatchObject({ hasAudio: false, saved: false });
    expect(getRecordingResult({ microphoneConnected: false, recordingSource: "built-in" })).toMatchObject({ hasAudio: true, hasIntendedInput: false, saved: true });
    expect(getRecordingResult({ recordingSaved: false })).toMatchObject({ hasAudio: true, hasIntendedInput: true, saved: false });
  });
});

describe("weather station", () => {
  it("preserves local collection and saving when network delivery fails", () => {
    const result = getWeatherResult({ weatherFault: "network" });
    expect(result.captured).toHaveLength(7);
    expect(result.saved).toHaveLength(7);
    expect(result.displayed.map((point) => point.time)).toEqual(["09:00", "09:05", "09:10", "09:15"]);
  });

  it("loses only unsaved readings when the recorder restarts", () => {
    const before = getWeatherResult({ weatherFault: "storage" });
    const after = getWeatherResult({ weatherFault: "storage", weatherRestarted: true });
    expect(before.displayed).toHaveLength(7);
    expect(before.saved).toHaveLength(4);
    expect(after.displayed).toEqual(before.saved);
    expect(after.captured).toHaveLength(7);
  });

  it("does not erase data when the output display fails", () => {
    const result = getWeatherResult({ weatherFault: "display", weatherRestarted: true });
    expect(result.delivered).toHaveLength(7);
    expect(result.saved).toHaveLength(7);
    expect(result.displayed).toHaveLength(0);
  });

  it.each(["sensor", "power", "software"] as const)("stops new collection when %s fails", (weatherFault) => {
    const result = getWeatherResult({ weatherFault });
    expect(result.captured).toHaveLength(4);
    expect(result.saved).toHaveLength(4);
    expect(result.displayed.at(-1)?.time).toBe("09:15");
  });

  it("keeps a healthy station's data after a restart", () => {
    const before = getWeatherResult({});
    const after = getWeatherResult({ weatherRestarted: true });
    expect(before.captured).toHaveLength(7);
    expect(after.displayed).toEqual(before.displayed);
  });
});
