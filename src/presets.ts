import {
  ArgumentCorrectnessMetric,
  StepEfficiencyMetric,
  TaskCompletionMetric,
  ToolCorrectnessMetric,
  ToolFaithfulnessMetric,
} from "./metrics/agent/index.js";
import type { AnyMetric } from "./metrics/base.js";
import {
  ConversationCompletenessMetric,
  KnowledgeRetentionMetric,
  RoleAdherenceMetric,
  TopicAdherenceMetric,
  TurnRelevancyMetric,
} from "./metrics/chatbot/index.js";
import {
  AnswerRelevancyMetric,
  ContextualPrecisionMetric,
  ContextualRecallMetric,
  ContextualRelevancyMetric,
  FaithfulnessMetric,
} from "./metrics/rag/index.js";
import {
  BiasMetric,
  HallucinationMetric,
  PiiLeakageMetric,
  PromptAlignmentMetric,
  ToxicityMetric,
} from "./metrics/safety/index.js";

/** Ready-made metric packs for common AI product surfaces. */
export const MetricPresets = {
  rag: (): AnyMetric[] => [
    new AnswerRelevancyMetric(),
    new FaithfulnessMetric({ threshold: 0.7 }),
    new ContextualRelevancyMetric(),
    new ContextualRecallMetric(),
    new ContextualPrecisionMetric(),
  ],

  chatbot: (): AnyMetric[] => [
    new ConversationCompletenessMetric(),
    new KnowledgeRetentionMetric(),
    new RoleAdherenceMetric(),
    new TurnRelevancyMetric(),
    new TopicAdherenceMetric(),
  ],

  agent: (): AnyMetric[] => [
    new TaskCompletionMetric(),
    new ToolCorrectnessMetric(),
    new ToolFaithfulnessMetric(),
    new ArgumentCorrectnessMetric(),
    new StepEfficiencyMetric(),
  ],

  safety: (): AnyMetric[] => [
    new HallucinationMetric(),
    new ToxicityMetric(),
    new BiasMetric(),
    new PiiLeakageMetric(),
    new PromptAlignmentMetric(),
  ],

  /** Broad smoke suite across domains (pick a subset for CI). */
  full: (): AnyMetric[] => [
    ...MetricPresets.rag(),
    ...MetricPresets.safety(),
  ],
} as const;
