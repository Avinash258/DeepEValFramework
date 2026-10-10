import { describe, expect, it } from "vitest";
import {
  mapChoice,
  mapNoul,
  mapScore,
  weightedMean,
} from "../src/metrics/jev/scoring.js";
import { Choice, Noul, Score } from "../src/metrics/jev/questions.js";

describe("JevEval scoring (worked Tool Faithfulness example)", () => {
  it("maps Noul / Score / Choice and weighted mean like the docs", () => {
    const q0 = new Noul({
      statement: "Every fact appears in tool output",
      weight: 2,
    });
    const q1 = new Noul({
      statement: "Reports tool values accurately",
    });
    const q2 = new Score({
      question: "How grounded?",
      levels: [
        "Fabricated",
        "Mostly fabricated",
        "Mostly grounded",
        "Fully grounded",
      ],
    });
    const q3 = new Choice({
      question: "What about missing info?",
      options: {
        left_it_out: 1.0,
        flagged_it_as_unknown: 1.0,
        hedged_it: 0.5,
        stated_it_as_fact: 0.0,
        nothing_missing: null,
      },
    });

    const m0 = mapNoul(q0, {
      id: "q_0",
      kind: "noul",
      pTrue: 0.3,
      confidence: 0.4,
    });
    const m1 = mapNoul(q1, {
      id: "q_1",
      kind: "noul",
      pTrue: 0.9,
      confidence: 0.8,
    });
    const m2 = mapScore(q2, {
      id: "q_2",
      kind: "score",
      probabilities: [0.05, 0.3, 0.55, 0.1],
      confidence: 0.55,
    });
    const m3 = mapChoice(q3, {
      id: "q_3",
      kind: "choice",
      probabilities: {
        left_it_out: 0.05,
        flagged_it_as_unknown: 0.05,
        hedged_it: 0.25,
        stated_it_as_fact: 0.6,
        nothing_missing: 0.05,
      },
      confidence: 0.6,
    });

    expect(m0.value).toBeCloseTo(0.3);
    expect(m1.value).toBeCloseTo(0.9);
    expect(m2.value).toBeCloseTo(0.5667, 3);
    expect(m3.applicable).toBe(true);
    expect(m3.value).toBeCloseTo(0.237, 2);

    const score = weightedMean([m0, m1, m2, m3]);
    expect(score).toBeCloseTo(0.461, 2);
  });

  it("drops Choice when NA mass >= 0.5", () => {
    const q = new Choice({
      question: "x",
      options: { good: 1, never_asked: null },
    });
    const m = mapChoice(q, {
      id: "q_0",
      kind: "choice",
      probabilities: { good: 0.4, never_asked: 0.6 },
      confidence: 0.6,
    });
    expect(m.applicable).toBe(false);
    expect(weightedMean([m])).toBe(1);
  });
});
