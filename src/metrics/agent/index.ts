import type { SystemOneJudge } from "../../judges/types.js";
import { SingleTurnParams } from "../../test-case/types.js";
import { BaseMetricOptions } from "../base.js";
import { JevEval } from "../jev/jev-eval.js";
import { Choice, Noul, Score } from "../jev/questions.js";

export interface AgentMetricOptions extends BaseMetricOptions {
  systemOneModel?: SystemOneJudge | string;
}

export class TaskCompletionMetric extends JevEval {
  constructor(options: AgentMetricOptions = {}) {
    super({
      name: options.name ?? "Task Completion",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
      ],
      questions: [
        new Noul({
          statement:
            "actual_output successfully completes the task described in input.",
          weight: 2,
        }),
        new Score({
          question: "How completely was the user's task finished?",
          levels: ["Failed", "Partial", "Mostly done", "Complete"],
        }),
        new Choice({
          question: "Does actual_output match expected_output intent?",
          options: {
            matches: 1.0,
            close: 0.6,
            diverges: 0.2,
            no_expected: null,
          },
        }),
      ],
    });
  }
}

export class ToolCorrectnessMetric extends JevEval {
  constructor(options: AgentMetricOptions = {}) {
    super({
      name: options.name ?? "Tool Correctness",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.TOOLS_CALLED,
        SingleTurnParams.EXPECTED_TOOLS,
      ],
      questions: [
        new Noul({
          statement:
            "The tools in tools_called are the right ones for solving input.",
          weight: 2,
        }),
        new Noul({
          statement:
            "tools_called match expected_tools in name and essential parameters when expected_tools is present.",
        }),
        new Choice({
          question: "How appropriate was the tool selection?",
          options: {
            correct_tools: 1.0,
            extra_harmless_tools: 0.7,
            missing_required_tools: 0.2,
            wrong_tools: 0.0,
            no_tools_needed: null,
          },
        }),
      ],
    });
  }
}

/** Tool faithfulness: output grounded in tool results (JevEval doc example). */
export class ToolFaithfulnessMetric extends JevEval {
  constructor(options: AgentMetricOptions = {}) {
    super({
      name: options.name ?? "Tool Faithfulness",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
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
  }
}

export class ArgumentCorrectnessMetric extends JevEval {
  constructor(options: AgentMetricOptions = {}) {
    super({
      name: options.name ?? "Argument Correctness",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.TOOLS_CALLED,
      ],
      questions: [
        new Noul({
          statement:
            "Tool input_parameters in tools_called correctly reflect the user's request in input.",
          weight: 2,
        }),
        new Score({
          question: "How correct are the tool arguments?",
          levels: ["Wrong", "Partly wrong", "Mostly correct", "Fully correct"],
        }),
      ],
    });
  }
}

export class StepEfficiencyMetric extends JevEval {
  constructor(options: AgentMetricOptions = {}) {
    super({
      name: options.name ?? "Step Efficiency",
      threshold: options.threshold,
      strictMode: options.strictMode,
      verboseMode: options.verboseMode,
      includeReason: options.includeReason,
      flaky: options.flaky,
      systemOneModel: options.systemOneModel,
      evaluationParams: [
        SingleTurnParams.INPUT,
        SingleTurnParams.TOOLS_CALLED,
        SingleTurnParams.ACTUAL_OUTPUT,
      ],
      questions: [
        new Noul({
          statement:
            "The agent did not make redundant or unnecessary tool calls for input.",
        }),
        new Score({
          question: "How efficient was the agent's trajectory?",
          levels: ["Wasteful", "Somewhat inefficient", "Reasonable", "Optimal"],
        }),
      ],
    });
  }
}
