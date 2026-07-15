import { describe, expect, it } from "vitest";
import { describePolicy, minutesToUnits, type RoundingPolicy } from "./credit-math";

// One wrong transcript number in a live demo is unrecoverable (SPEC.md).
// This table is the demo's credibility anchor: quarter-hour increments,
// all three modes, across 15/50/60/90-minute sessions.

const quarterHour = (mode: RoundingPolicy["mode"]): RoundingPolicy => ({
  minutesPerUnit: 60,
  incrementMinutes: 15,
  mode,
});

describe("quarter-hour rounding on clock hours", () => {
  // [minutes, FLOOR, NEAREST, CEILING]
  const table: [number, number, number, number][] = [
    [15, 0.25, 0.25, 0.25],
    [50, 0.75, 0.75, 1.0],
    [60, 1.0, 1.0, 1.0],
    [90, 1.5, 1.5, 1.5],
  ];

  for (const [minutes, floor, nearest, ceiling] of table) {
    it(`${minutes} minutes → floor ${floor}, nearest ${nearest}, ceiling ${ceiling}`, () => {
      expect(minutesToUnits(minutes, quarterHour("FLOOR"))).toBe(floor);
      expect(minutesToUnits(minutes, quarterHour("NEAREST"))).toBe(nearest);
      expect(minutesToUnits(minutes, quarterHour("CEILING"))).toBe(ceiling);
    });
  }

  it("odd in-between lengths break ties predictably", () => {
    // 70 min = 4.67 quarter-hours
    expect(minutesToUnits(70, quarterHour("FLOOR"))).toBe(1.0);
    expect(minutesToUnits(70, quarterHour("NEAREST"))).toBe(1.25);
    expect(minutesToUnits(70, quarterHour("CEILING"))).toBe(1.25);
    // Exactly half an increment rounds up under NEAREST (educator's favor).
    expect(minutesToUnits(7.5, quarterHour("NEAREST"))).toBe(0.25);
    // 75 min lands exactly on an increment; all modes agree.
    expect(minutesToUnits(75, quarterHour("FLOOR"))).toBe(1.25);
    expect(minutesToUnits(75, quarterHour("NEAREST"))).toBe(1.25);
    expect(minutesToUnits(75, quarterHour("CEILING"))).toBe(1.25);
  });

  it("zero and negative durations award nothing", () => {
    expect(minutesToUnits(0, quarterHour("CEILING"))).toBe(0);
    expect(minutesToUnits(-30, quarterHour("CEILING"))).toBe(0);
  });

  it("floating point stays clean at increment boundaries", () => {
    // 3 × 0.1-style float drift must never turn 60 minutes into 0.9999 hours.
    expect(minutesToUnits(60, quarterHour("FLOOR"))).toBe(1.0);
    expect(minutesToUnits(45, quarterHour("FLOOR"))).toBe(0.75);
    expect(minutesToUnits(105, quarterHour("FLOOR"))).toBe(1.75);
  });
});

describe("other credit currencies", () => {
  it("CEUs: 600 minutes per unit, floor at quarter-hour", () => {
    const ceu: RoundingPolicy = { minutesPerUnit: 600, incrementMinutes: 15, mode: "FLOOR" };
    expect(minutesToUnits(90, ceu)).toBe(0.15);
    expect(minutesToUnits(50, ceu)).toBe(0.075);
    expect(minutesToUnits(600, ceu)).toBe(1.0);
  });

  it("half-hour ceiling contact hours", () => {
    const flex: RoundingPolicy = { minutesPerUnit: 60, incrementMinutes: 30, mode: "CEILING" };
    expect(minutesToUnits(50, flex)).toBe(1.0);
    expect(minutesToUnits(15, flex)).toBe(0.5);
    expect(minutesToUnits(90, flex)).toBe(1.5);
  });
});

describe("plain-language policy description", () => {
  it("reads like a sentence a PD coordinator would sign off on", () => {
    expect(describePolicy(quarterHour("NEAREST"), "hours")).toBe(
      "Session time is rounded to the nearest quarter hour. Sixty minutes of instruction equal 1.0 hour.",
    );
    expect(describePolicy(quarterHour("FLOOR"), "hours")).toContain("rounded down to the quarter hour");
  });
});
