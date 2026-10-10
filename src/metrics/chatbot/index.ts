import type { SystemOneJudge } from "../../judges/types.js";
import { MultiTurnParams } from "../../test-case/types.js";
import { BaseMetricOptions } from "../base.js";
import { ConversationalJevEval } from "../jev/jev-eval.js";
import { Choice, Noul, Score } from "../jev/questions.js";

export interface ChatMetricOptions extends BaseMetricOptions {
  systemOneModel?: SystemOneJudge | string;
}

export class ConversationCompletenessMetric extends ConversationalJevEval {
  constructor(options: ChatMetricOptions = {}) {
    super({
      name: options.name ?? "Conversation Completeness",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        MultiTurnParams.SCENARIO,
        MultiTurnParams.EXPECTED_OUTCOME,
      ],
      questions: [
        new Noul({
          statement:
            "By the end of turns, the assistant has addressed the user's main request in the scenario.",
          weight: 2,
        }),
        new Score({
          question: "How fully is the user's request settled by the end of turns?",
          levels: ["Not addressed", "Partly settled", "Fully resolved"],
        }),
        new Choice({
          question: "Did the conversation reach expected_outcome?",
          options: {
            fully: 1.0,
            partially: 0.5,
            not_at_all: 0.0,
            outcome_not_applicable: null,
          },
        }),
      ],
    });
  }
}

export class KnowledgeRetentionMetric extends ConversationalJevEval {
  constructor(options: ChatMetricOptions = {}) {
    super({
      name: options.name ?? "Knowledge Retention",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [],
      questions: [
        new Noul({
          statement:
            "The assistant correctly remembers facts the user stated earlier in turns.",
          weight: 2,
        }),
        new Choice({
          question: "How does the assistant treat earlier user-provided facts?",
          options: {
            remembers_correctly: 1.0,
            asks_again_unnecessarily: 0.4,
            contradicts_earlier_facts: 0.0,
            no_facts_to_retain: null,
          },
        }),
      ],
    });
  }
}

export class RoleAdherenceMetric extends ConversationalJevEval {
  constructor(options: ChatMetricOptions = {}) {
    super({
      name: options.name ?? "Role Adherence",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [MultiTurnParams.CHATBOT_ROLE],
      questions: [
        new Noul({
          statement:
            "Throughout turns, the assistant stays in chatbot_role.",
          weight: 2,
        }),
        new Score({
          question: "How consistently does the assistant adhere to chatbot_role?",
          levels: ["Broke character", "Occasionally drifted", "Mostly adhered", "Fully adhered"],
        }),
      ],
    });
  }
}

export class TurnRelevancyMetric extends ConversationalJevEval {
  constructor(options: ChatMetricOptions = {}) {
    super({
      name: options.name ?? "Turn Relevancy",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [],
      questions: [
        new Noul({
          statement:
            "Each assistant turn is relevant to the immediately preceding user turn.",
          weight: 2,
        }),
        new Score({
          question: "Overall turn-level relevancy across the conversation?",
          levels: ["Irrelevant", "Mixed", "Mostly relevant", "Fully relevant"],
        }),
      ],
    });
  }
}

export class TopicAdherenceMetric extends ConversationalJevEval {
  constructor(options: ChatMetricOptions = {}) {
    super({
      name: options.name ?? "Topic Adherence",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [MultiTurnParams.SCENARIO],
      questions: [
        new Noul({
          statement:
            "The assistant stays on the topic implied by the scenario throughout turns.",
        }),
        new Choice({
          question: "Did the assistant digress from the scenario topic?",
          options: {
            stayed_on_topic: 1.0,
            mild_digression: 0.5,
            major_digression: 0.0,
            scenario_open_ended: null,
          },
        }),
      ],
    });
  }
}
