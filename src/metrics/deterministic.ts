import { LLMTestCase } from "../test-case/llm-test-case.js";
import {
  BaseMetricOptions,
  MetricResult,
  SingleTurnMetric,
} from "./base.js";

export interface JsonCorrectnessOptions extends BaseMetricOptions {
  /** Optional JSON Schema-like expected keys (shallow). */
  requiredKeys?: string[];
}

/** Deterministic: actual_output must be valid JSON (optionally with keys). */
export class JsonCorrectnessMetric extends SingleTurnMetric {
  readonly name: string;
  private readonly requiredKeys: string[];

  constructor(options: JsonCorrectnessOptions = {}) {
    super(options);
    this.name = options.name ?? "JSON Correctness";
    this.requiredKeys = options.requiredKeys ?? [];
  }

  async measure(testCase: LLMTestCase): Promise<MetricResult> {
    let score = 0;
    let reason = "";
    try {
      const parsed = JSON.parse(testCase.actualOutput) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        reason = "Output is JSON but not a non-null object.";
        score = 0.3;
      } else {
        const obj = parsed as Record<string, unknown>;
        const missing = this.requiredKeys.filter((k) => !(k in obj));
        if (missing.length) {
          score = Math.max(0, 1 - missing.length / this.requiredKeys.length);
          reason = `Missing keys: ${missing.join(", ")}`;
        } else {
          score = 1;
          reason = "Valid JSON object with required keys.";
        }
      }
    } catch {
      reason = "actual_output is not valid JSON.";
      score = 0;
    }
    return this.finalize(score, {
      reason,
      scoreBreakdown: [
        {
          question: "Is actual_output valid JSON with required shape?",
          type: "deterministic",
          weight: 1,
          value: score,
          applicable: true,
        },
      ],
    });
  }
}

export interface ExactMatchOptions extends BaseMetricOptions {
  normalize?: boolean;
}

export class ExactMatchMetric extends SingleTurnMetric {
  readonly name = "Exact Match";
  private readonly normalize: boolean;

  constructor(options: ExactMatchOptions = {}) {
    super({ threshold: options.threshold ?? 1, ...options });
    this.normalize = options.normalize ?? true;
  }

  async measure(testCase: LLMTestCase): Promise<MetricResult> {
    if (testCase.expectedOutput === undefined) {
      throw new Error("ExactMatchMetric requires expectedOutput.");
    }
    const a = this.normalize
      ? testCase.actualOutput.trim().toLowerCase()
      : testCase.actualOutput;
    const b = this.normalize
      ? testCase.expectedOutput.trim().toLowerCase()
      : testCase.expectedOutput;
    const score = a === b ? 1 : 0;
    return this.finalize(score, {
      reason: score ? "Outputs match." : "Outputs differ.",
    });
  }
}

/** Simple token F1 vs expected_output. */
export class TokenF1Metric extends SingleTurnMetric {
  readonly name = "Token F1";

  constructor(options: BaseMetricOptions = {}) {
    super(options);
  }

  async measure(testCase: LLMTestCase): Promise<MetricResult> {
    if (!testCase.expectedOutput) {
      throw new Error("TokenF1Metric requires expectedOutput.");
    }
    const tok = (s: string) =>
      new Set(s.toLowerCase().split(/\W+/).filter(Boolean));
    const pred = tok(testCase.actualOutput);
    const gold = tok(testCase.expectedOutput);
    let overlap = 0;
    for (const t of pred) if (gold.has(t)) overlap++;
    const precision = pred.size ? overlap / pred.size : 0;
    const recall = gold.size ? overlap / gold.size : 0;
    const score =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    return this.finalize(score, {
      reason: `precision=${precision.toFixed(2)} recall=${recall.toFixed(2)}`,
    });
  }
}
