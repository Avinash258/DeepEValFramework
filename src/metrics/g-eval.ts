import {
  OpenAiCompatibleJudge,
  parseJsonFromLlm,
  type LlmJudge,
} from "../judges/index.js";
import { LLMTestCase } from "../test-case/llm-test-case.js";
import {
  BaseMetricOptions,
  MetricResult,
  SingleTurnMetric,
} from "./base.js";

export interface GEvalOptions extends BaseMetricOptions {
  name: string;
  /** One-line criteria; the judge drafts evaluation steps. */
  criteria: string;
  evaluationSteps?: string[];
  model?: LlmJudge | string;
}

/**
 * LLM-as-a-judge custom metric (DeepEval G-Eval style).
 * Use when you want the LLM to invent evaluation logic from criteria.
 * Prefer JevEval when you already know the questions and want deterministic runs.
 */
export class GEval extends SingleTurnMetric {
  readonly name: string;
  readonly criteria: string;
  readonly evaluationSteps?: string[];
  private readonly judge: LlmJudge;

  constructor(options: GEvalOptions) {
    super(options);
    this.name = options.name;
    this.criteria = options.criteria;
    this.evaluationSteps = options.evaluationSteps;
    this.judge =
      typeof options.model === "object" && options.model
        ? options.model
        : new OpenAiCompatibleJudge({
            model: typeof options.model === "string" ? options.model : undefined,
          });
  }

  async measure(testCase: LLMTestCase): Promise<MetricResult> {
    const steps =
      this.evaluationSteps?.join("\n") ??
      `Derive clear evaluation steps for: ${this.criteria}`;

    const prompt = `You are an evaluation judge. Score the LLM output from 0 to 10.

Criteria: ${this.criteria}
Evaluation steps:
${steps}

Input: ${testCase.input}
Actual output: ${testCase.actualOutput}
${testCase.expectedOutput ? `Expected output: ${testCase.expectedOutput}` : ""}
${testCase.retrievalContext?.length ? `Retrieval context: ${JSON.stringify(testCase.retrievalContext)}` : ""}

Respond ONLY with JSON: {"score": <0-10 number>, "reason": "<short reason>"}`;

    const raw = await this.judge.complete([
      { role: "system", content: "You evaluate LLM outputs rigorously." },
      { role: "user", content: prompt },
    ]);
    const parsed = parseJsonFromLlm<{ score: number; reason: string }>(raw);
    const score = Math.min(1, Math.max(0, Number(parsed.score) / 10));
    return this.finalize(score, {
      reason: parsed.reason,
      scoreBreakdown: [
        {
          question: this.criteria,
          type: "llm",
          weight: 1,
          value: score,
          applicable: true,
          detail: `raw_score=${parsed.score}`,
        },
      ],
    });
  }
}
