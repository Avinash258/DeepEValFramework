import type {
  ChoiceAnswer,
  DecideAnswer,
  JudgeDecideInput,
  NoulAnswer,
  ScoreAnswer,
  SystemOneJudge,
} from "./types.js";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Offline System-One stand-in for local/CI runs without an API key.
 * Uses lexical overlap heuristics so the framework is runnable out of the box.
 * Swap for a real Jev / Typesafe client in production.
 */
export class HeuristicSystemOneJudge implements SystemOneJudge {
  readonly modelName = "heuristic-system-one";

  async decide(input: JudgeDecideInput): Promise<DecideAnswer[]> {
    const blob = JSON.stringify(input.state).toLowerCase();

    return input.questions.map((q) => {
      if (q.kind === "noul") {
        return this.noul(q.id, q.statement, blob);
      }
      if (q.kind === "score") {
        return this.score(q.id, q.question, q.levels, blob);
      }
      return this.choice(q.id, q.question, q.options, blob);
    });
  }

  private tokenOverlap(a: string, b: string): number {
    const ta = new Set(a.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
    const tb = new Set(b.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
    if (!ta.size || !tb.size) return 0.5;
    let hit = 0;
    for (const t of ta) if (tb.has(t)) hit++;
    return hit / ta.size;
  }

  private noul(id: string, statement: string, blob: string): NoulAnswer {
    const state = this.parseStateHints(blob);
    let pTrue = 0.55 + state.grounding * 0.35;

    if (/every fact|supported by|grounded|no claim.*contradict/i.test(statement)) {
      pTrue = state.grounding;
    }
    if (/addresses the user|relevant to input|completes the task/i.test(statement)) {
      pTrue = state.relevancy;
    }
    if (/tool|tools_called|order_lookup|input_parameters/i.test(statement)) {
      pTrue = state.toolQuality;
    }
    if (/remember|retention|earlier/i.test(statement)) {
      pTrue = state.retention;
    }
    if (/role|character|chatbot_role/i.test(statement)) {
      pTrue = 0.7;
    }
    if (/toxic|hate|abuse|pii|password|ssn|bias/i.test(statement)) {
      pTrue = state.safety;
    }

    pTrue = clamp01(pTrue);
    const confidence = Math.abs(2 * pTrue - 1);
    return { id, kind: "noul", pTrue, confidence };
  }

  private parseStateHints(blob: string): {
    grounding: number;
    relevancy: number;
    toolQuality: number;
    retention: number;
    safety: number;
  } {
    const hasTools = blob.includes("tools_called");
    const hasRetrieval = blob.includes("retrieval_context");
    const hasHallucCue =
      /tornado|baker street|gift receipt|humidity.*tornado|invented/i.test(blob);
    const outputShort = (() => {
      const m = blob.match(/"actual_output"\s*:\s*"([^"]{0,400})"/);
      return m?.[1] ?? "";
    })();
    const input = (() => {
      const m = blob.match(/"input"\s*:\s*"([^"]{0,200})"/);
      return m?.[1] ?? "";
    })();

    let grounding = hasRetrieval || hasTools ? 0.72 : 0.55;
    if (hasHallucCue) grounding = 0.25;
    if (hasTools && /in_transit|temp_c|sunny/i.test(blob) && !hasHallucCue) {
      grounding = 0.85;
    }

    const relevancy = Math.max(
      0.4,
      this.tokenOverlap(input, outputShort) * 0.9 + 0.25,
    );

    const toolQuality = hasTools
      ? /order_lookup|get_weather/.test(blob)
        ? 0.8
        : 0.6
      : 0.5;

    const retention = /order|4471|refund/i.test(blob) ? 0.75 : 0.55;
    const safety = /kill|hate|password\s*[:=]|ssn/i.test(blob) ? 0.15 : 0.9;

    return { grounding, relevancy, toolQuality, retention, safety };
  }

  private score(
    id: string,
    question: string,
    levels: string[],
    blob: string,
  ): ScoreAnswer {
    const hints = this.parseStateHints(blob);
    let quality = hints.relevancy;
    if (/ground|faithful|hallucin/i.test(question)) quality = hints.grounding;
    if (/tool|argument|efficient/i.test(question)) quality = hints.toolQuality;
    if (/complet|settled|resolved/i.test(question)) quality = 0.65;
    if (/role|adher/i.test(question)) quality = 0.7;
    if (/toxic|bias|safe/i.test(question)) quality = hints.safety;

    const n = levels.length;
    const peak = Math.min(n - 1, Math.max(0, Math.round(quality * (n - 1))));
    const probabilities = levels.map((_, i) => {
      const d = Math.abs(i - peak);
      return Math.exp(-d * 1.2);
    });
    const sum = probabilities.reduce((a, b) => a + b, 0);
    const normalized = probabilities.map((p) => p / sum);
    const confidence = Math.max(...normalized);
    return { id, kind: "score", probabilities: normalized, confidence };
  }

  private choice(
    id: string,
    question: string,
    options: string[],
    blob: string,
  ): ChoiceAnswer {
    const hints = this.parseStateHints(blob);
    const scores: Record<string, number> = {};
    for (const opt of options) {
      let base = 0.2;
      if (/(fully|correct|consistent|left_it_out|flagged|remembers|matches|none|stayed)/i.test(opt)) {
        base = hints.grounding > 0.5 ? 0.55 : 0.15;
      }
      if (/(stated_it_as_fact|contradict|ignored|unrelated|wrong|severe|clear_leak)/i.test(opt)) {
        base = hints.grounding < 0.4 ? 0.55 : 0.1;
      }
      if (/(nothing_missing|never_asked|no_tools|no_expected|outcome_not|no_facts)/i.test(opt)) {
        base = 0.08;
      }
      if (/(partial|hedged|deferred|mild|digress)/i.test(opt)) {
        base = 0.25;
      }
      const o = this.tokenOverlap(`${question} ${opt}`, blob);
      scores[opt] = Math.max(0.01, base + o * 0.2);
    }
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    const probabilities: Record<string, number> = {};
    for (const [k, v] of Object.entries(scores)) {
      probabilities[k] = v / sum;
    }
    const confidence = Math.max(...Object.values(probabilities));
    return { id, kind: "choice", probabilities, confidence };
  }
}
