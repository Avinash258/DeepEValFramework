import { HeuristicSystemOneJudge } from "../../judges/heuristic-judge.js";
import type { DecideRequest, SystemOneJudge } from "../../judges/types.js";
import { ConversationalTestCase } from "../../test-case/conversational-test-case.js";
import { LLMTestCase } from "../../test-case/llm-test-case.js";
import {
  MultiTurnParams,
  SingleTurnParams,
} from "../../test-case/types.js";
import {
  BaseMetricOptions,
  MetricResult,
  MultiTurnMetric,
  SingleTurnMetric,
} from "../base.js";
import type { JevQuestion } from "./questions.js";
import {
  buildReason,
  mapAnswers,
  strictScore,
  toBreakdown,
  weightedMean,
} from "./scoring.js";

export interface JevEvalOptions extends BaseMetricOptions {
  name: string;
  evaluationParams?: SingleTurnParams[];
  questions: JevQuestion[];
  systemOneModel?: SystemOneJudge | string;
}

function resolveJudge(model?: SystemOneJudge | string): SystemOneJudge {
  if (!model || typeof model === "string") {
    return new HeuristicSystemOneJudge();
  }
  return model;
}

function toDecideRequests(questions: JevQuestion[]): DecideRequest[] {
  return questions.map((q, i) => {
    const id = `q_${i}`;
    if (q.kind === "noul") {
      return {
        id,
        kind: "noul",
        statement: q.statement,
        trueDescription: q.trueDescription,
        falseDescription: q.falseDescription,
      };
    }
    if (q.kind === "score") {
      return { id, kind: "score", question: q.question, levels: q.levels };
    }
    return {
      id,
      kind: "choice",
      question: q.question,
      options: Object.keys(q.options),
    };
  });
}

async function measureWithJev(
  self: SingleTurnMetric | MultiTurnMetric,
  judge: SystemOneJudge,
  questions: JevQuestion[],
  state: Record<string, unknown>,
): Promise<MetricResult> {
  const answers = await judge.decide({
    state,
    questions: toDecideRequests(questions),
  });
  const mapped = mapAnswers(questions, answers);
  const score = self.strictMode ? strictScore(mapped) : weightedMean(mapped);
  const breakdown = toBreakdown(mapped);
  const applicable = mapped.filter((m) => m.applicable);
  const confidence = applicable.length
    ? Math.min(...applicable.map((m) => m.confidence))
    : 1;
  const reason = self.includeReason
    ? buildReason(judge.modelName, mapped, score)
    : undefined;
  return self.finalize(score, {
    reason,
    scoreBreakdown: breakdown,
    confidence,
  });
}

export class JevEval extends SingleTurnMetric {
  readonly name: string;
  readonly evaluationParams?: SingleTurnParams[];
  readonly questions: JevQuestion[];
  private readonly judge: SystemOneJudge;

  constructor(options: JevEvalOptions) {
    super(options);
    if (!options.questions.length) {
      throw new Error("JevEval requires at least one question.");
    }
    this.name = options.name;
    this.evaluationParams = options.evaluationParams;
    this.questions = options.questions;
    this.judge = resolveJudge(options.systemOneModel);
  }

  async measure(testCase: LLMTestCase): Promise<MetricResult> {
    const state = testCase.toState(this.evaluationParams);
    return measureWithJev(this, this.judge, this.questions, state);
  }
}

export interface ConversationalJevEvalOptions extends BaseMetricOptions {
  name: string;
  evaluationParams?: MultiTurnParams[];
  questions: JevQuestion[];
  systemOneModel?: SystemOneJudge | string;
}

export class ConversationalJevEval extends MultiTurnMetric {
  readonly name: string;
  readonly evaluationParams?: MultiTurnParams[];
  readonly questions: JevQuestion[];
  private readonly judge: SystemOneJudge;

  constructor(options: ConversationalJevEvalOptions) {
    super(options);
    if (!options.questions.length) {
      throw new Error("ConversationalJevEval requires at least one question.");
    }
    this.name = options.name;
    this.evaluationParams = options.evaluationParams;
    this.questions = options.questions;
    this.judge = resolveJudge(options.systemOneModel);
  }

  async measure(testCase: ConversationalTestCase): Promise<MetricResult> {
    const state = testCase.toState(this.evaluationParams);
    return measureWithJev(this, this.judge, this.questions, state);
  }
}
