import { describe, expect, it } from "vitest";

import { ringGeometry, ringStrokeWidth } from "@/components/data-display/ring-geometry";

describe("ringGeometry", () => {
  it("leaves the visible arc proportional to the value", () => {
    const g = ringGeometry(75, 168, 6);
    expect(g.radius).toBe(81);
    expect(g.center).toBe(84);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 81);
    expect(g.dashOffset).toBeCloseTo(g.circumference * 0.25);
  });

  it("draws nothing at 0 and a full circle at 100", () => {
    expect(ringGeometry(0, 96, 4).dashOffset).toBeCloseTo(
      ringGeometry(0, 96, 4).circumference,
    );
    expect(ringGeometry(100, 96, 4).dashOffset).toBeCloseTo(0);
  });

  it("clamps out-of-range and non-finite values", () => {
    expect(ringGeometry(140, 96, 4).clamped).toBe(100);
    expect(ringGeometry(-5, 96, 4).clamped).toBe(0);
    expect(ringGeometry(Number.NaN, 96, 4).clamped).toBe(0);
  });

  it("falls back to a max of 100 when max is not positive", () => {
    expect(ringGeometry(50, 96, 4, 0).dashOffset).toBeCloseTo(
      ringGeometry(50, 96, 4).dashOffset,
    );
  });
});

describe("ringStrokeWidth", () => {
  it("stays thin and scales with size", () => {
    expect(ringStrokeWidth(96)).toBe(4);
    expect(ringStrokeWidth(128)).toBe(5);
    expect(ringStrokeWidth(168)).toBe(6);
  });
});
