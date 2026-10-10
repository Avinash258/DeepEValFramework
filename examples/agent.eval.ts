/**
 * Tool-using agent evaluation.
 */
import {
  ArgumentCorrectnessMetric,
  evaluate,
  LLMTestCase,
  TaskCompletionMetric,
  ToolCall,
  ToolCorrectnessMetric,
  ToolFaithfulnessMetric,
} from "../src/index.js";

const good = new LLMTestCase({
  name: "order-status-ok",
  input: "Where is my order #1234?",
  actualOutput: "Your order #1234 is in_transit.",
  expectedOutput: "Order is in transit",
  toolsCalled: [
    new ToolCall({
      name: "order_lookup",
      inputParameters: { order_id: "1234" },
      output: { status: "in_transit" },
    }),
  ],
  expectedTools: [
    new ToolCall({
      name: "order_lookup",
      inputParameters: { order_id: "1234" },
    }),
  ],
});

const hallucinated = new LLMTestCase({
  name: "order-status-hallucination",
  input: "Where is my order #1234?",
  actualOutput:
    "Your order #1234 was delivered yesterday to 221B Baker Street with a gift receipt.",
  toolsCalled: [
    new ToolCall({
      name: "order_lookup",
      inputParameters: { order_id: "1234" },
      output: { status: "in_transit" },
    }),
  ],
  expectedTools: [
    new ToolCall({
      name: "order_lookup",
      inputParameters: { order_id: "1234" },
    }),
  ],
});

await evaluate([good, hallucinated], [
  new TaskCompletionMetric(),
  new ToolCorrectnessMetric(),
  new ToolFaithfulnessMetric({ threshold: 0.5 }),
  new ArgumentCorrectnessMetric(),
]);
