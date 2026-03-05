import { describe, expect, it } from "vitest";
import {
  RADAR_DIMENSIONS,
  averageRadarScores,
  normalizeRadarScores,
  toRadarPolygonPoints,
} from "./interview-radar";

describe("normalizeRadarScores", () => {
  it("maps zh/en aliases and normalizes 5-point scores to percentage", () => {
    const result = normalizeRadarScores({
      专业能力: 4.5,
      confidence: 4,
      语言表达: 3.5,
      problem_solving: 5,
      adaptability: 3,
    });

    expect(result.professional).toBe(90);
    expect(result.confidence).toBe(80);
    expect(result.expression).toBe(70);
    expect(result.logic).toBe(100);
    expect(result.adaptability).toBe(60);
  });

  it("clamps out-of-range values", () => {
    const result = normalizeRadarScores({
      technical: 120,
      自信: -3,
    });

    expect(result.professional).toBe(100);
    expect(result.confidence).toBe(0);
  });
});

describe("averageRadarScores", () => {
  it("averages multiple dimensions", () => {
    const result = averageRadarScores([
      { 专业能力: 4, 自信: 3.5, 语言表达: 4, logic: 4, adaptability: 3 },
      {
        technical: 5,
        confidence: 4,
        communication: 3,
        问题解决: 4.5,
        应变能力: 4,
      },
    ]);

    expect(result.professional).toBe(90);
    expect(result.confidence).toBe(75);
    expect(result.expression).toBe(70);
    expect(result.logic).toBe(85);
    expect(result.adaptability).toBe(70);
  });
});

describe("toRadarPolygonPoints", () => {
  it("returns same number of points as dimensions", () => {
    const points = toRadarPolygonPoints(
      RADAR_DIMENSIONS.map(() => 80),
      200,
      24,
    );

    expect(points.split(" ").length).toBe(RADAR_DIMENSIONS.length);
  });
});
