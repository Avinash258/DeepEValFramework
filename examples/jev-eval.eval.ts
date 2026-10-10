/**
 * Tool Faithfulness — mirrors https://deepeval.com/docs/metrics-jev-eval
 */
import {
  Choice,
  evaluate,
  LLMTestCase,
  Noul,
  Score,
  SingleTurnParams,
  ToolCall,
  ToolFaithfulnessMetric,
  JevEval,
} from "../src/index.js";

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

const testCase = new LLMTestCase({
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
});

await evaluate([testCase], [toolFaithfulness, new ToolFaithfulnessMetric()]);
