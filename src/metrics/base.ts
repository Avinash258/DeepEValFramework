import type { ConversationalTestCase } from "../test-case/conversational-test-case.js";
import type { LLMTestCase } from "../test-case/llm-test-case.js";

export type AnyTestCase = LLMTestCase | ConversationalTestCase;

export interface MetricScoreBreakdown {
  question: string;
  type: "noul" | "score" | "choice" | "llm" | "deterministic";
  weight: number;
  value: number;
  applicable: boolean;
  probabilities?: Record<string, number>;
  confidence?: number;
  passed?: boolean | null;
  detail?: string;
}

export interface MetricResult {
  name: string;
  score: number;
  success: boolean;
  threshold: number | null;
  reason?: string;
  scoreBreakdown?: MetricScoreBreakdown[];
  confidence?: number;
  error?: string;
  /** When true, a failed score does not fail the overall test case. */
  flaky?: boolean;
}

export interface BaseMetricOptions {
  name?: string;
  threshold?: number | null;
  strictMode?: boolean;
  verboseMode?: boolean;
  includeReason?: boolean;
  flaky?: boolean;
}

/**
 * Generic base so subclasses can specialize the test-case type without
 * incompatible `measure` overrides (the usual IDE/TS error in this file).
 */
export abstract class BaseMetric<T extends AnyTestCase = AnyTestCase> {
  abstract readonly name: string;
  threshold: number | null;
  strictMode: boolean;
  verboseMode: boolean;
  includeReason: boolean;
  flaky: boolean;

  score?: number;
  reason?: string;
  scoreBreakdown?: MetricScoreBreakdown[];
  confidence?: number;
  success?: boolean;

  constructor(options: BaseMetricOptions = {}) {
    this.threshold = options.threshold === undefined ? 0.5 : options.threshold;
    this.strictMode = options.strictMode ?? false;
    this.verboseMode = options.verboseMode ?? false;
    this.includeReason = options.includeReason ?? true;
    this.flaky = options.flaky ?? false;
    if (this.strictMode) this.threshold = 1;
  }

  abstract measure(testCase: T): Promise<MetricResult>;

  finalize(
    score: number,
    extras: Omit<Partial<MetricResult>, "name" | "score" | "success" | "threshold"> = {},
  ): MetricResult {
    const threshold = this.threshold;
    const safeScore = Number.isFinite(score) ? score : 0;
    // Pass/fail is threshold-only. `flaky` only softens suite aggregation.
    const success = threshold === null ? true : safeScore >= threshold;

    this.score = safeScore;
    this.success = success;
    this.reason = extras.reason;
    this.scoreBreakdown = extras.scoreBreakdown;
    this.confidence = extras.confidence;

    if (this.verboseMode) {
      console.log(
        `[${this.name}] score=${safeScore.toFixed(3)} success=${success}`,
      );
      if (extras.scoreBreakdown) {
        for (const row of extras.scoreBreakdown) {
          console.log(
            `  - [${row.type}] ${row.question.slice(0, 80)}... value=${row.value.toFixed(3)} applicable=${row.applicable}`,
          );
        }
      }
    }

    return {
      name: this.name,
      score: safeScore,
      success,
      threshold,
      flaky: this.flaky,
      reason: extras.reason,
      scoreBreakdown: extras.scoreBreakdown,
      confidence: extras.confidence,
      error: extras.error,
    };
  }
}

export abstract class SingleTurnMetric extends BaseMetric<LLMTestCase> {
  abstract measure(testCase: LLMTestCase): Promise<MetricResult>;
}

export abstract class MultiTurnMetric extends BaseMetric<ConversationalTestCase> {
  abstract measure(testCase: ConversationalTestCase): Promise<MetricResult>;
}

/** Heterogeneous metric list for `evaluate()`. */
export type AnyMetric = SingleTurnMetric | MultiTurnMetric;
