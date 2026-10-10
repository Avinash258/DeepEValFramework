import { MultiTurnParams, Turn } from "./types.js";

export interface ConversationalTestCaseOptions {
  turns: Turn[];
  scenario?: string;
  expectedOutcome?: string;
  chatbotRole?: string;
  userDescription?: string;
  name?: string;
  additionalMetadata?: Record<string, unknown>;
}

export class ConversationalTestCase {
  readonly turns: Turn[];
  readonly scenario?: string;
  readonly expectedOutcome?: string;
  readonly chatbotRole?: string;
  readonly userDescription?: string;
  readonly name?: string;
  readonly additionalMetadata?: Record<string, unknown>;

  constructor(options: ConversationalTestCaseOptions) {
    if (!options.turns.length) {
      throw new Error("ConversationalTestCase requires at least one turn.");
    }
    this.turns = options.turns;
    this.scenario = options.scenario;
    this.expectedOutcome = options.expectedOutcome;
    this.chatbotRole = options.chatbotRole;
    this.userDescription = options.userDescription;
    this.name = options.name;
    this.additionalMetadata = options.additionalMetadata;
  }

  toState(params?: MultiTurnParams[]): Record<string, unknown> {
    const extra = new Set(params ?? []);
    // content + role always present via turns
    const state: Record<string, unknown> = {
      turns: this.turns.map((t) => t.toJSON()),
    };

    if (extra.has(MultiTurnParams.SCENARIO) || this.scenario !== undefined) {
      if (extra.size === 0 || extra.has(MultiTurnParams.SCENARIO)) {
        state.scenario = this.scenario;
      }
    }
    if (
      extra.has(MultiTurnParams.EXPECTED_OUTCOME) ||
      this.expectedOutcome !== undefined
    ) {
      if (extra.size === 0 || extra.has(MultiTurnParams.EXPECTED_OUTCOME)) {
        state.expected_outcome = this.expectedOutcome;
      }
    }
    if (
      extra.has(MultiTurnParams.CHATBOT_ROLE) ||
      this.chatbotRole !== undefined
    ) {
      if (extra.size === 0 || extra.has(MultiTurnParams.CHATBOT_ROLE)) {
        state.chatbot_role = this.chatbotRole;
      }
    }
    if (
      extra.has(MultiTurnParams.USER_DESCRIPTION) ||
      this.userDescription !== undefined
    ) {
      if (extra.size === 0 || extra.has(MultiTurnParams.USER_DESCRIPTION)) {
        state.user_description = this.userDescription;
      }
    }

    // Only list explicitly requested extras when params provided
    if (params && params.length > 0) {
      const filtered: Record<string, unknown> = {
        turns: state.turns,
      };
      for (const p of params) {
        if (p === MultiTurnParams.CONTENT || p === MultiTurnParams.ROLE) continue;
        const key = p as string;
        if (key in state) filtered[key] = state[key];
        else if (p === MultiTurnParams.SCENARIO) filtered.scenario = this.scenario;
        else if (p === MultiTurnParams.EXPECTED_OUTCOME)
          filtered.expected_outcome = this.expectedOutcome;
        else if (p === MultiTurnParams.CHATBOT_ROLE)
          filtered.chatbot_role = this.chatbotRole;
        else if (p === MultiTurnParams.USER_DESCRIPTION)
          filtered.user_description = this.userDescription;
      }
      return filtered;
    }

    return state;
  }
}
