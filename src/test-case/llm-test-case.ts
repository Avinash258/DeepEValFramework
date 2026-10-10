import { SingleTurnParams, ToolCall } from "./types.js";

export interface LLMTestCaseOptions {
  input: string;
  actualOutput: string;
  expectedOutput?: string;
  /** Ground-truth / reference context (e.g. for hallucination). */
  context?: string[];
  /** Retrieved chunks for RAG evaluation. */
  retrievalContext?: string[];
  toolsCalled?: ToolCall[];
  expectedTools?: ToolCall[];
  name?: string;
  additionalMetadata?: Record<string, unknown>;
  /** Agent trace for trajectory-mode JevEval. */
  trace?: Record<string, unknown>;
}

export class LLMTestCase {
  readonly input: string;
  readonly actualOutput: string;
  readonly expectedOutput?: string;
  readonly context?: string[];
  readonly retrievalContext?: string[];
  readonly toolsCalled?: ToolCall[];
  readonly expectedTools?: ToolCall[];
  readonly name?: string;
  readonly additionalMetadata?: Record<string, unknown>;
  readonly trace?: Record<string, unknown>;

  constructor(options: LLMTestCaseOptions) {
    this.input = options.input;
    this.actualOutput = options.actualOutput;
    this.expectedOutput = options.expectedOutput;
    this.context = options.context;
    this.retrievalContext = options.retrievalContext;
    this.toolsCalled = options.toolsCalled;
    this.expectedTools = options.expectedTools;
    this.name = options.name;
    this.additionalMetadata = options.additionalMetadata;
    this.trace = options.trace;
  }

  /** Build snake_case state JSON for judges / Jev. */
  toState(params?: SingleTurnParams[]): Record<string, unknown> {
    if (!params || params.length === 0) {
      if (this.trace) return { trace: this.trace };
      throw new Error(
        "MissingTestCaseParamsError: evaluationParams required, or provide a trace for trajectory mode.",
      );
    }

    const state: Record<string, unknown> = {};
    for (const p of params) {
      switch (p) {
        case SingleTurnParams.INPUT:
          state.input = this.input;
          break;
        case SingleTurnParams.ACTUAL_OUTPUT:
          state.actual_output = this.actualOutput;
          break;
        case SingleTurnParams.EXPECTED_OUTPUT:
          state.expected_output = this.expectedOutput;
          break;
        case SingleTurnParams.CONTEXT:
          state.context = this.context;
          break;
        case SingleTurnParams.RETRIEVAL_CONTEXT:
          state.retrieval_context = this.retrievalContext;
          break;
        case SingleTurnParams.TOOLS_CALLED:
          state.tools_called = this.toolsCalled?.map((t) => t.toJSON());
          break;
        case SingleTurnParams.EXPECTED_TOOLS:
          state.expected_tools = this.expectedTools?.map((t) => t.toJSON());
          break;
      }
    }
    return { test_case: state };
  }
}
