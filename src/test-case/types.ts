/** Shared primitives for single-turn and multi-turn evaluation. */

export type Role = "user" | "assistant" | "system" | "tool";

export interface ToolCallOptions {
  name: string;
  inputParameters?: Record<string, unknown>;
  output?: unknown;
  description?: string;
  /** Optional error if the tool call failed. */
  error?: string;
}

export class ToolCall {
  readonly name: string;
  readonly inputParameters: Record<string, unknown>;
  readonly output: unknown;
  readonly description?: string;
  readonly error?: string;

  constructor(options: ToolCallOptions) {
    this.name = options.name;
    this.inputParameters = options.inputParameters ?? {};
    this.output = options.output;
    this.description = options.description;
    this.error = options.error;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: "FUNCTION",
      input_parameters: this.inputParameters,
      output: this.output,
      ...(this.description ? { description: this.description } : {}),
      ...(this.error ? { error: this.error } : {}),
    };
  }
}

export interface TurnOptions {
  role: Role;
  content: string;
  retrievalContext?: string[];
  toolsCalled?: ToolCall[];
  additionalMetadata?: Record<string, unknown>;
}

export class Turn {
  readonly role: Role;
  readonly content: string;
  readonly retrievalContext?: string[];
  readonly toolsCalled?: ToolCall[];
  readonly additionalMetadata?: Record<string, unknown>;

  constructor(options: TurnOptions) {
    this.role = options.role;
    this.content = options.content;
    this.retrievalContext = options.retrievalContext;
    this.toolsCalled = options.toolsCalled;
    this.additionalMetadata = options.additionalMetadata;
  }

  toJSON(): Record<string, unknown> {
    return {
      role: this.role,
      content: this.content,
      ...(this.retrievalContext
        ? { retrieval_context: this.retrievalContext }
        : {}),
      ...(this.toolsCalled
        ? { tools_called: this.toolsCalled.map((t) => t.toJSON()) }
        : {}),
      ...(this.additionalMetadata
        ? { additional_metadata: this.additionalMetadata }
        : {}),
    };
  }
}

/** Fields Jev / judges may see for a single-turn case. */
export enum SingleTurnParams {
  INPUT = "input",
  ACTUAL_OUTPUT = "actual_output",
  EXPECTED_OUTPUT = "expected_output",
  CONTEXT = "context",
  RETRIEVAL_CONTEXT = "retrieval_context",
  TOOLS_CALLED = "tools_called",
  EXPECTED_TOOLS = "expected_tools",
}

/** Extra conversation-level fields (role/content always included). */
export enum MultiTurnParams {
  SCENARIO = "scenario",
  EXPECTED_OUTCOME = "expected_outcome",
  CHATBOT_ROLE = "chatbot_role",
  USER_DESCRIPTION = "user_description",
  RETRIEVAL_CONTEXT = "retrieval_context",
  TOOLS_CALLED = "tools_called",
  CONTENT = "content",
  ROLE = "role",
}
