/**
 * Multi-turn support chatbot evaluation.
 */
import {
  ConversationCompletenessMetric,
  ConversationalTestCase,
  evaluate,
  KnowledgeRetentionMetric,
  MultiTurnParams,
  RoleAdherenceMetric,
  Turn,
  TurnRelevancyMetric,
  ConversationalJevEval,
  Noul,
  Score,
  Choice,
} from "../src/index.js";

const refundHandling = new ConversationalJevEval({
  name: "Refund Handling",
  evaluationParams: [
    MultiTurnParams.SCENARIO,
    MultiTurnParams.EXPECTED_OUTCOME,
  ],
  questions: [
    new Noul({
      statement: "The assistant verifies the order before acting on the refund.",
    }),
    new Score({
      question: "How fully is the user's request settled by the end of turns?",
      levels: ["Not addressed", "Partly settled", "Fully resolved"],
    }),
    new Choice({
      question: "What did the assistant do about the amount the user asked for?",
      options: {
        stated_it: 1.0,
        deferred_it: 0.5,
        ignored_it: 0.0,
        never_asked: null,
      },
    }),
  ],
});

const convo = new ConversationalTestCase({
  name: "late-order-refund",
  scenario: "A customer asks for a refund on a late order.",
  expectedOutcome: "The refund amount is confirmed.",
  chatbotRole: "A polite customer-support agent for an online store.",
  turns: [
    new Turn({
      role: "user",
      content: "My order arrived a week late. I want a refund.",
    }),
    new Turn({
      role: "assistant",
      content: "Sorry about that. What is your order number?",
    }),
    new Turn({ role: "user", content: "It's 4471. How much do I get back?" }),
    new Turn({
      role: "assistant",
      content: "You'll receive a refund within 5-7 days.",
    }),
    new Turn({ role: "user", content: "ok thanks" }),
  ],
});

await evaluate([convo], [
  refundHandling,
  new ConversationCompletenessMetric(),
  new KnowledgeRetentionMetric(),
  new RoleAdherenceMetric(),
  new TurnRelevancyMetric(),
]);
