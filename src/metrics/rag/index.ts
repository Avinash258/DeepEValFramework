import type { SystemOneJudge } from "../../judges/types.js";
import { SingleTurnParams } from "../../test-case/types.js";
import { BaseMetricOptions } from "../base.js";
import { JevEval } from "../jev/jev-eval.js";
import { Choice, Noul, Score } from "../jev/questions.js";

export interface RagMetricOptions extends BaseMetricOptions {
  systemOneModel?: SystemOneJudge | string;
}

/** Generator: is the answer relevant to the user input? */
export class AnswerRelevancyMetric extends JevEval {
  constructor(options: RagMetricOptions = {}) {
    super({
      name: options.name ?? "Answer Relevancy",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
      ],
      questions: [
        new Noul({
          statement:
            "actual_output directly addresses the user's question in input.",
          weight: 2,
        }),
        new Score({
          question: "How relevant is actual_output to input?",
          levels: [
            "Off-topic",
            "Tangentially related",
            "Mostly on-topic",
            "Fully relevant",
          ],
        }),
        new Choice({
          question: "What best describes actual_output relative to input?",
          options: {
            answers_fully: 1.0,
            answers_partially: 0.6,
            refuses_appropriately: 0.8,
            digresses: 0.2,
            unrelated: 0.0,
          },
        }),
      ],
    });
  }
}

/** Generator: claims grounded in retrieval_context. */
export class FaithfulnessMetric extends JevEval {
  constructor(options: RagMetricOptions = {}) {
    super({
      name: options.name ?? "Faithfulness",
      threshold: options.threshold ?? 0.7,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.RETRIEVAL_CONTEXT,
      ],
      questions: [
        new Noul({
          statement:
            "Every factual claim in actual_output is supported by the facts in retrieval_context.",
          weight: 2,
        }),
        new Noul({
          statement:
            "No claim in actual_output contradicts the facts in retrieval_context.",
        }),
        new Score({
          question:
            "How much of actual_output is grounded in the facts in retrieval_context?",
          levels: [
            "Fabricated",
            "Mostly fabricated",
            "Mostly grounded",
            "Fully grounded",
          ],
        }),
      ],
    });
  }
}

/** Retriever: are retrieved chunks relevant to the query? */
export class ContextualRelevancyMetric extends JevEval {
  constructor(options: RagMetricOptions = {}) {
    super({
      name: options.name ?? "Contextual Relevancy",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.RETRIEVAL_CONTEXT,
      ],
      questions: [
        new Noul({
          statement:
            "Most chunks in retrieval_context are useful for answering input.",
          weight: 2,
        }),
        new Score({
          question: "Overall relevancy of retrieval_context to input?",
          levels: ["Irrelevant", "Weakly relevant", "Mostly relevant", "Highly relevant"],
        }),
      ],
    });
  }
}

/** Retriever: does context contain info needed for expected_output? */
export class ContextualRecallMetric extends JevEval {
  constructor(options: RagMetricOptions = {}) {
    super({
      name: options.name ?? "Contextual Recall",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.EXPECTED_OUTPUT,
        SingleTurnParams.RETRIEVAL_CONTEXT,
      ],
      questions: [
        new Noul({
          statement:
            "retrieval_context contains the information needed to produce expected_output.",
          weight: 2,
        }),
        new Score({
          question:
            "How completely does retrieval_context cover expected_output?",
          levels: ["Missing", "Partial", "Mostly complete", "Complete"],
        }),
      ],
    });
  }
}

/** Retriever: ranking quality — relevant chunks appear early. */
export class ContextualPrecisionMetric extends JevEval {
  constructor(options: RagMetricOptions = {}) {
    super({
      name: options.name ?? "Contextual Precision",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
        SingleTurnParams.RETRIEVAL_CONTEXT,
      ],
      questions: [
        new Noul({
          statement:
            "Relevant chunks in retrieval_context appear before irrelevant ones for answering input.",
          weight: 2,
        }),
        new Score({
          question: "How precise is the ranking in retrieval_context?",
          levels: ["Poor ranking", "Mixed", "Mostly precise", "Highly precise"],
        }),
      ],
    });
  }
}
