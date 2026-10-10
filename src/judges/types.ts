/** Pluggable decision backends (System-One style or LLM-as-judge). */

export type NoulDecideRequest = {
  id: string;
  kind: "noul";
  statement: string;
  trueDescription?: string;
  falseDescription?: string;
};

export type ScoreDecideRequest = {
  id: string;
  kind: "score";
  question: string;
  levels: string[];
};

export type ChoiceDecideRequest = {
  id: string;
  kind: "choice";
  question: string;
  options: string[];
};

export type DecideRequest =
  | NoulDecideRequest
  | ScoreDecideRequest
  | ChoiceDecideRequest;

export type NoulAnswer = {
  id: string;
  kind: "noul";
  pTrue: number;
  confidence: number;
};

export type ScoreAnswer = {
  id: string;
  kind: "score";
  probabilities: number[];
  confidence: number;
};

export type ChoiceAnswer = {
  id: string;
  kind: "choice";
  probabilities: Record<string, number>;
  confidence: number;
};

export type DecideAnswer = NoulAnswer | ScoreAnswer | ChoiceAnswer;

export interface JudgeDecideInput {
  state: Record<string, unknown>;
  questions: DecideRequest[];
}

export interface SystemOneJudge {
  readonly modelName: string;
  decide(input: JudgeDecideInput): Promise<DecideAnswer[]>;
}

export interface LlmJudgeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmJudge {
  readonly modelName: string;
  complete(messages: LlmJudgeMessage[]): Promise<string>;
}
