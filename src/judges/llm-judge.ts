import type { LlmJudge, LlmJudgeMessage } from "./types.js";

export interface OpenAiCompatibleJudgeOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * OpenAI-compatible chat judge for G-Eval style LLM-as-a-judge metrics.
 * Set OPENAI_API_KEY (or pass apiKey). Works with Azure OpenAI / OpenRouter via baseUrl.
 */
export class OpenAiCompatibleJudge implements LlmJudge {
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: OpenAiCompatibleJudgeOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    this.modelName = options.model ?? "gpt-4.1-mini";
  }

  async complete(messages: LlmJudgeMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "OpenAiCompatibleJudge requires OPENAI_API_KEY or options.apiKey",
      );
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0,
        messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Judge API error ${res.status}: ${text}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

/** Parse a JSON object from an LLM reply (strips fences). */
export function parseJsonFromLlm<T = Record<string, unknown>>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Could not parse JSON from judge response: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}
