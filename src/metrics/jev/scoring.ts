import type {
  ChoiceAnswer,
  DecideAnswer,
  NoulAnswer,
  ScoreAnswer,
} from "../../judges/types.js";
import type { MetricScoreBreakdown } from "../base.js";
import type { Choice, JevQuestion, Noul, Score } from "./questions.js";

export interface MappedQuestion {
  question: JevQuestion;
  value: number;
  applicable: boolean;
  probabilities: Record<string, number>;
  confidence: number;
  passed: boolean | null;
}

export function mapNoul(q: Noul, answer: NoulAnswer): MappedQuestion {
  const value = clamp01(answer.pTrue);
  const confidence = answer.confidence ?? Math.abs(2 * value - 1);
  return {
    question: q,
    value,
    applicable: true,
    probabilities: { true: value, false: 1 - value },
    confidence,
    passed: value >= 0.5,
  };
}

export function mapScore(q: Score, answer: ScoreAnswer): MappedQuestion {
  const n = q.levels.length;
  const probs = answer.probabilities;
  if (probs.length !== n) {
    throw new Error(
      `Score answer length ${probs.length} does not match levels ${n}`,
    );
  }
  let expected = 0;
  const named: Record<string, number> = {};
  for (let k = 0; k < n; k++) {
    const p = probs[k] ?? 0;
    expected += k * p;
    named[q.levels[k]!] = p;
  }
  const value = n === 1 ? 1 : expected / (n - 1);
  const topIdx = probs.indexOf(Math.max(...probs));
  return {
    question: q,
    value: clamp01(value),
    applicable: true,
    probabilities: named,
    confidence: answer.confidence,
    passed: topIdx === n - 1,
  };
}

export function mapChoice(q: Choice, answer: ChoiceAnswer): MappedQuestion {
  const probs = answer.probabilities;
  let naMass = 0;
  let applicableMass = 0;
  let weighted = 0;

  for (const [opt, credit] of Object.entries(q.options)) {
    const p = probs[opt] ?? 0;
    if (credit === null) {
      naMass += p;
    } else {
      applicableMass += p;
      weighted += p * credit;
    }
  }

  const applicable = naMass < 0.5;
  const value =
    !applicable || applicableMass === 0 ? 0 : weighted / applicableMass;

  let bestOpt: string | null = null;
  let bestP = -1;
  for (const [opt, credit] of Object.entries(q.options)) {
    if (credit === null) continue;
    const p = probs[opt] ?? 0;
    if (p > bestP) {
      bestP = p;
      bestOpt = opt;
    }
  }
  const passed =
    bestOpt !== null && (q.options[bestOpt] ?? 0) === 1.0 ? true : false;

  return {
    question: q,
    value: clamp01(value),
    applicable,
    probabilities: probs,
    confidence: answer.confidence,
    passed: applicable ? passed : null,
  };
}

export function mapAnswers(
  questions: JevQuestion[],
  answers: DecideAnswer[],
): MappedQuestion[] {
  const byId = new Map(answers.map((a) => [a.id, a]));
  return questions.map((q, i) => {
    const id = `q_${i}`;
    const answer = byId.get(id);
    if (!answer) throw new Error(`Missing answer for ${id}`);
    if (q.kind === "noul" && answer.kind === "noul") return mapNoul(q, answer);
    if (q.kind === "score" && answer.kind === "score") return mapScore(q, answer);
    if (q.kind === "choice" && answer.kind === "choice")
      return mapChoice(q, answer);
    throw new Error(`Mismatched answer kind for ${id}`);
  });
}

export function weightedMean(mapped: MappedQuestion[]): number {
  const applicable = mapped.filter((m) => m.applicable);
  if (!applicable.length) return 1;
  let num = 0;
  let den = 0;
  for (const m of applicable) {
    num += m.question.weight * m.value;
    den += m.question.weight;
  }
  return den === 0 ? 1 : num / den;
}

export function strictScore(mapped: MappedQuestion[]): number {
  const applicable = mapped.filter((m) => m.applicable);
  if (!applicable.length) return 1;
  return applicable.every((m) => m.passed === true) ? 1 : 0;
}

export function toBreakdown(mapped: MappedQuestion[]): MetricScoreBreakdown[] {
  return mapped.map((m) => ({
    question:
      m.question.kind === "noul" ? m.question.statement : m.question.question,
    type: m.question.kind,
    weight: m.question.weight,
    value: m.value,
    applicable: m.applicable,
    probabilities: m.probabilities,
    confidence: m.confidence,
    passed: m.passed,
  }));
}

export function buildReason(
  modelName: string,
  mapped: MappedQuestion[],
  score: number,
): string {
  const applicable = mapped.filter((m) => m.applicable);
  const minConf = applicable.length
    ? Math.min(...applicable.map((m) => m.confidence))
    : 1;
  const lines: string[] = [
    `Decided by ${modelName}, minimum confidence ${minConf.toFixed(2)}.`,
  ];

  mapped.forEach((m, i) => {
    const label =
      m.question.kind === "noul" ? m.question.statement : m.question.question;
    if (!m.applicable) {
      lines.push(`${i + 1}. ${label} -> not applicable`);
      return;
    }
    if (m.question.kind === "noul") {
      const tone =
        m.value >= 0.75
          ? "clearly holds"
          : m.value >= 0.5
            ? "leans true"
            : m.value >= 0.25
              ? "likely fails"
              : "clearly fails";
      lines.push(
        `${i + 1}. ${label} -> ${tone} (P(yes)=${m.value.toFixed(2)}, confidence=${m.confidence.toFixed(2)}${m.question.weight !== 1 ? `, weight=${m.question.weight}` : ""})`,
      );
      return;
    }
    if (m.question.kind === "score") {
      const levels = m.question.levels;
      const expectedLevel = m.value * (levels.length - 1);
      const idx = Math.round(expectedLevel);
      const levelName = levels[Math.min(levels.length - 1, Math.max(0, idx))];
      lines.push(
        `${i + 1}. ${label} -> "${levelName}" (expected level=${m.value.toFixed(2)} of 1.00, confidence=${m.confidence.toFixed(2)})`,
      );
      return;
    }
    // choice
    let best = "";
    let bestP = -1;
    for (const [k, v] of Object.entries(m.probabilities)) {
      if (v > bestP) {
        bestP = v;
        best = k;
      }
    }
    lines.push(
      `${i + 1}. ${label} -> "${best}" (P=${bestP.toFixed(2)}, confidence=${m.confidence.toFixed(2)})`,
    );
  });

  lines.push(
    `Score: ${score.toFixed(2)} (weighted mean of ${applicable.length} applicable questions).`,
  );
  return lines.join("\n");
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
