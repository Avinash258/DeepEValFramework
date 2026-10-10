import type { AnyMetric, MetricResult } from "./metrics/base.js";
import { MultiTurnMetric, SingleTurnMetric } from "./metrics/base.js";
import { ConversationalTestCase } from "./test-case/conversational-test-case.js";
import { LLMTestCase } from "./test-case/llm-test-case.js";

export type EvalTestCase = LLMTestCase | ConversationalTestCase;

export interface TestCaseResult {
  testCaseName?: string;
  inputPreview: string;
  metrics: MetricResult[];
  success: boolean;
}

export interface EvaluationReport {
  results: TestCaseResult[];
  passCount: number;
  failCount: number;
  success: boolean;
}

export interface EvaluateOptions {
  concurrency?: number;
  print?: boolean;
}

function preview(testCase: EvalTestCase): string {
  if ("input" in testCase) return testCase.input.slice(0, 120);
  if ("scenario" in testCase && testCase.scenario)
    return testCase.scenario.slice(0, 120);
  return testCase.turns[0]?.content.slice(0, 120) ?? "(conversation)";
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Run metrics against one or more test cases (single-turn and/or multi-turn).
 */
export async function evaluate(
  testCases: EvalTestCase | EvalTestCase[],
  metrics: AnyMetric[],
  options: EvaluateOptions = {},
): Promise<EvaluationReport> {
  const cases = Array.isArray(testCases) ? testCases : [testCases];
  const concurrency = options.concurrency ?? 4;
  const print = options.print ?? true;

  const results = await mapPool(cases, concurrency, async (tc) => {
    const metricResults: MetricResult[] = [];
    for (const metric of metrics) {
      try {
        if (
          metric instanceof SingleTurnMetric &&
          !(tc instanceof LLMTestCase)
        ) {
          throw new Error(
            `${metric.name} is a single-turn metric but received a ConversationalTestCase`,
          );
        }
        if (
          metric instanceof MultiTurnMetric &&
          !(tc instanceof ConversationalTestCase)
        ) {
          throw new Error(
            `${metric.name} is a multi-turn metric but received an LLMTestCase`,
          );
        }
        let result: MetricResult;
        if (metric instanceof SingleTurnMetric) {
          result = await metric.measure(tc as LLMTestCase);
        } else {
          result = await metric.measure(tc as ConversationalTestCase);
        }
        metricResults.push(result);
      } catch (err) {
        metricResults.push({
          name: metric.name,
          score: 0,
          success: false,
          threshold: metric.threshold,
          flaky: metric.flaky,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // Flaky metric failures do not fail the test case.
    const success = metricResults.every((m) => m.success || m.flaky);
    return {
      testCaseName: tc.name,
      inputPreview: preview(tc),
      metrics: metricResults,
      success,
    } satisfies TestCaseResult;
  });

  const passCount = results.filter((r) => r.success).length;
  const failCount = results.length - passCount;
  const report: EvaluationReport = {
    results,
    passCount,
    failCount,
    success: failCount === 0,
  };

  if (print) {
    console.log("\n═══ Evaluation Report ═══");
    for (const r of results) {
      const mark = r.success ? "PASS" : "FAIL";
      console.log(`\n[${mark}] ${r.testCaseName ?? r.inputPreview}`);
      for (const m of r.metrics) {
        const ms = m.success ? "✓" : "✗";
        const err = m.error ? ` error=${m.error}` : "";
        console.log(
          `  ${ms} ${m.name}: ${m.score.toFixed(3)} (threshold=${m.threshold})${err}`,
        );
        if (m.reason && options.print !== false) {
          const first = m.reason.split("\n")[0];
          console.log(`      ${first}`);
        }
      }
    }
    console.log(
      `\nSummary: ${passCount} passed, ${failCount} failed (of ${results.length})`,
    );
  }

  return report;
}
