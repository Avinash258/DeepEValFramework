import { resolve } from "node:path";
import {
  AnswerRelevancyMetric,
  ArgumentCorrectnessMetric,
  Choice,
  ConversationCompletenessMetric,
  ConversationalJevEval,
  ConversationalTestCase,
  ContextualRecallMetric,
  ContextualRelevancyMetric,
  evaluate,
  FaithfulnessMetric,
  JevEval,
  KnowledgeRetentionMetric,
  LLMTestCase,
  MultiTurnParams,
  Noul,
  RoleAdherenceMetric,
  Score,
  SingleTurnParams,
  TaskCompletionMetric,
  ToolCall,
  ToolCorrectnessMetric,
  ToolFaithfulnessMetric,
  Turn,
  TurnRelevancyMetric,
} from "../src/index.js";
import { writeHtmlReport, type SuiteReport } from "../src/report/html-report.js";

const suites: SuiteReport[] = [];

// --- JevEval ---
{
  const toolFaithfulness = new JevEval({
    name: "Tool Faithfulness",
    evaluationParams: [
      SingleTurnParams.INPUT,
      SingleTurnParams.ACTUAL_OUTPUT,
      SingleTurnParams.TOOLS_CALLED,
    ],
    questions: [
      new Noul({
        statement:
          "Every fact and figure in actual_output appears in the output of a tool in tools_called.",
        weight: 2,
      }),
      new Noul({
        statement:
          "actual_output reports every value returned in tools_called accurately.",
      }),
      new Score({
        question:
          "How much of actual_output is grounded in the outputs in tools_called?",
        levels: [
          "Fabricated",
          "Mostly fabricated",
          "Mostly grounded",
          "Fully grounded",
        ],
      }),
      new Choice({
        question:
          "What did actual_output do with information the tools did not return?",
        options: {
          left_it_out: 1.0,
          flagged_it_as_unknown: 1.0,
          hedged_it: 0.5,
          stated_it_as_fact: 0.0,
          nothing_missing: null,
        },
      }),
    ],
  });

  const report = await evaluate(
    [
      new LLMTestCase({
        name: "paris-weather",
        input: "What's the weather in Paris right now?",
        actualOutput:
          "It's 18°C and sunny in Paris, with a light breeze and around 40% humidity.",
        toolsCalled: [
          new ToolCall({
            name: "get_weather",
            inputParameters: { city: "Paris" },
            output: { temp_c: 18, condition: "sunny" },
          }),
        ],
      }),
    ],
    [toolFaithfulness, new ToolFaithfulnessMetric()],
    { print: false },
  );
  suites.push({ name: "JevEval — Tool Faithfulness", report });
}

// --- RAG ---
{
  const retrievalContext = [
    "Paris average temperature in spring is around 15–20°C.",
    "The Eiffel Tower is located in Paris, France.",
    "Humidity in Paris today is reported near 40% by local weather services.",
  ];
  const report = await evaluate(
    [
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
    ],
    [
      new AnswerRelevancyMetric({ threshold: 0.5 }),
      new FaithfulnessMetric({ threshold: 0.6 }),
      new ContextualRelevancyMetric(),
      new ContextualRecallMetric(),
    ],
    { print: false },
  );
  suites.push({ name: "RAG", report });
}

// --- Chatbot ---
{
  const refundHandling = new ConversationalJevEval({
    name: "Refund Handling",
    evaluationParams: [
      MultiTurnParams.SCENARIO,
      MultiTurnParams.EXPECTED_OUTCOME,
    ],
    questions: [
      new Noul({
        statement:
          "The assistant verifies the order before acting on the refund.",
      }),
      new Score({
        question:
          "How fully is the user's request settled by the end of turns?",
        levels: ["Not addressed", "Partly settled", "Fully resolved"],
      }),
      new Choice({
        question:
          "What did the assistant do about the amount the user asked for?",
        options: {
          stated_it: 1.0,
          deferred_it: 0.5,
          ignored_it: 0.0,
          never_asked: null,
        },
      }),
    ],
  });

  const report = await evaluate(
    [
      new ConversationalTestCase({
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
          new Turn({
            role: "user",
            content: "It's 4471. How much do I get back?",
          }),
          new Turn({
            role: "assistant",
            content: "You'll receive a refund within 5-7 days.",
          }),
          new Turn({ role: "user", content: "ok thanks" }),
        ],
      }),
    ],
    [
      refundHandling,
      new ConversationCompletenessMetric(),
      new KnowledgeRetentionMetric(),
      new RoleAdherenceMetric(),
      new TurnRelevancyMetric(),
    ],
    { print: false },
  );
  suites.push({ name: "Chatbot (multi-turn)", report });
}

// --- Agent ---
{
  const report = await evaluate(
    [
      new LLMTestCase({
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
      }),
      new LLMTestCase({
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
      }),
    ],
    [
      new TaskCompletionMetric(),
      new ToolCorrectnessMetric(),
      new ToolFaithfulnessMetric({ threshold: 0.5 }),
      new ArgumentCorrectnessMetric(),
    ],
    { print: false },
  );
  suites.push({ name: "Agent (tools)", report });
}

const out = resolve("reports/evaluation-report.html");
writeHtmlReport(out, suites, "DeepEVal Framework — Evaluation Report");
console.log(`HTML report written to:\n${out}`);
