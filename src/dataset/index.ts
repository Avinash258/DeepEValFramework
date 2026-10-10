import { evaluate, type EvaluationReport } from "../evaluate.js";
import type { AnyMetric } from "../metrics/base.js";
import { LLMTestCase } from "../test-case/llm-test-case.js";

export interface GoldenOptions {
  input: string;
  expectedOutput?: string;
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, unknown>;
}

/** Dataset row before the app under test produces actualOutput. */
export class Golden {
  readonly input: string;
  readonly expectedOutput?: string;
  readonly context?: string[];
  readonly retrievalContext?: string[];
  readonly additionalMetadata?: Record<string, unknown>;

  constructor(options: GoldenOptions) {
    this.input = options.input;
    this.expectedOutput = options.expectedOutput;
    this.context = options.context;
    this.retrievalContext = options.retrievalContext;
    this.additionalMetadata = options.additionalMetadata;
  }

  toTestCase(actualOutput: string): LLMTestCase {
    return new LLMTestCase({
      input: this.input,
      actualOutput,
      expectedOutput: this.expectedOutput,
      context: this.context,
      retrievalContext: this.retrievalContext,
      additionalMetadata: this.additionalMetadata,
    });
  }
}

export interface EvaluationDatasetOptions {
  goldens: Golden[];
}

export class EvaluationDataset {
  readonly goldens: Golden[];

  constructor(options: EvaluationDatasetOptions) {
    this.goldens = options.goldens;
  }

  /**
   * Iterate goldens, run your app, collect test cases, then evaluate.
   * Usage:
   *   for await (const { golden, setOutput } of dataset.evalsIterator({ metrics })) {
   *     setOutput(await myApp(golden.input));
   *   }
   */
  async *evalsIterator(options: {
    metrics: AnyMetric[];
    print?: boolean;
  }): AsyncGenerator<{
    golden: Golden;
    setOutput: (
      actualOutput: string,
      extras?: {
        retrievalContext?: string[];
        toolsCalled?: LLMTestCase["toolsCalled"];
        expectedTools?: LLMTestCase["expectedTools"];
        trace?: Record<string, unknown>;
      },
    ) => void;
  }> {
    const cases: LLMTestCase[] = [];

    for (const golden of this.goldens) {
      let captured: LLMTestCase | null = null;
      yield {
        golden,
        setOutput: (actualOutput, extras = {}) => {
          captured = new LLMTestCase({
            input: golden.input,
            actualOutput,
            expectedOutput: golden.expectedOutput,
            context: golden.context,
            retrievalContext:
              extras.retrievalContext ?? golden.retrievalContext,
            toolsCalled: extras.toolsCalled,
            expectedTools: extras.expectedTools,
            additionalMetadata: golden.additionalMetadata,
            trace: extras.trace,
          });
        },
      };
      if (!captured) {
        throw new Error(
          `evalsIterator: call setOutput() for golden input "${golden.input.slice(0, 60)}"`,
        );
      }
      cases.push(captured);
    }

    const report = await evaluate(cases, options.metrics, {
      print: options.print ?? true,
    });
    // Attach last report for callers that want it via side channel
    (this as EvaluationDataset & { lastReport?: EvaluationReport }).lastReport =
      report;
  }

  async evaluateWith(
    runApp: (golden: Golden) => Promise<string | LLMTestCase>,
    metrics: AnyMetric[],
  ): Promise<EvaluationReport> {
    const cases: LLMTestCase[] = [];
    for (const golden of this.goldens) {
      const out = await runApp(golden);
      cases.push(
        typeof out === "string" ? golden.toTestCase(out) : out,
      );
    }
    return evaluate(cases, metrics);
  }
}
