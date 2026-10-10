/**
 * RAG pipeline eval — generator + retriever metrics.
 */
import {
  AnswerRelevancyMetric,
  ContextualRecallMetric,
  ContextualRelevancyMetric,
  evaluate,
  FaithfulnessMetric,
  LLMTestCase,
} from "../src/index.js";

const retrievalContext = [
  "Paris average temperature in spring is around 15–20°C.",
  "The Eiffel Tower is located in Paris, France.",
  "Humidity in Paris today is reported near 40% by local weather services.",
];

const cases = [
  new LLMTestCase({
    name: "grounded-answer",
    input: "Where is the Eiffel Tower?",
    actualOutput: "The Eiffel Tower is located in Paris, France.",
    expectedOutput: "Paris, France",
    retrievalContext,
  }),
  new LLMTestCase({
    name: "hallucinated-detail",
    input: "What is the humidity in Paris today?",
    actualOutput:
      "Humidity is 40%, and there is a severe tornado warning across all of France.",
    expectedOutput: "Around 40%",
    retrievalContext,
  }),
];

await evaluate(cases, [
  new AnswerRelevancyMetric({ threshold: 0.5 }),
  new FaithfulnessMetric({ threshold: 0.6 }),
  new ContextualRelevancyMetric(),
  new ContextualRecallMetric(),
]);
