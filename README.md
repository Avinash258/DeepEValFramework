# DeepEVal Framework (TypeScript)

A TypeScript evaluation framework for AI applications — **RAG**, **chatbots**, **agents**, **safety**, and **custom metrics** — inspired by [DeepEval](https://deepeval.com) / [JevEval](https://deepeval.com/docs/metrics-jev-eval).

Scores are `0–1`. A metric passes when `score >= threshold`.

## Install & build

```bash
npm install
npm run build
npm test
```

## Architecture

```
src/
  test-case/     LLMTestCase, ConversationalTestCase, ToolCall, Turn
  judges/        System-One (heuristic / pluggable) + OpenAI-compatible LLM judge
  metrics/
    jev/         Noul, Score, Choice, JevEval, ConversationalJevEval
    rag/         Answer relevancy, faithfulness, contextual *
    chatbot/     Completeness, retention, role, turn relevancy, topic
    agent/       Task completion, tool correctness / faithfulness, args, efficiency
    safety/      Hallucination, toxicity, bias, PII, prompt alignment
    g-eval.ts    Criteria → LLM-as-judge
    deterministic.ts  JSON / exact match / token F1
  dataset/       Golden + EvaluationDataset
  evaluate.ts    Batch runner + report
```

## How it works

Wrap app outputs as test cases, pick metrics, call `evaluate()`. Each metric builds a JSON **state**, asks a judge questions, maps answers to `0–1`, and passes when `score >= threshold`.

### Framework workflow

```mermaid
flowchart TB
  subgraph inputs [1. Inputs]
    App[Your AI app<br/>RAG / Chatbot / Agent]
    Golden[Golden dataset<br/>or live outputs]
    Metrics[Metrics pack<br/>RAG / Chatbot / Agent / JevEval / GEval]
  end

  subgraph cases [2. Test cases]
    Single[LLMTestCase<br/>input, actualOutput,<br/>retrievalContext, toolsCalled]
    Multi[ConversationalTestCase<br/>turns, scenario,<br/>expectedOutcome]
  end

  subgraph runner [3. evaluate]
    Eval[evaluate testCases, metrics]
    TypeCheck{Metric type?}
    ST[SingleTurnMetric.measure]
    MT[MultiTurnMetric.measure]
  end

  subgraph score [4. Score to Pass/Fail]
    Result[MetricResult<br/>score 0-1, reason, breakdown]
    Pass{score >= threshold?}
    CaseOK[Test case PASS / FAIL]
    Report[EvaluationReport<br/>+ optional HTML report]
  end

  App --> Golden
  Golden --> Single
  Golden --> Multi
  Metrics --> Eval
  Single --> Eval
  Multi --> Eval
  Eval --> TypeCheck
  TypeCheck -->|single-turn| ST
  TypeCheck -->|multi-turn| MT
  ST --> Result
  MT --> Result
  Result --> Pass
  Pass --> CaseOK
  CaseOK --> Report
```

### JevEval scoring path

Most built-in metrics are JevEval presets. Flow:

```mermaid
flowchart LR
  TC[Test case] --> State[toState evaluationParams<br/>snake_case JSON]
  Q[Questions<br/>Noul / Score / Choice] --> Decide
  State --> Decide[SystemOneJudge.decide<br/>heuristic or Jev API]
  Decide --> Map[Map each answer to value 0-1]
  Map --> Drop{Choice N/A<br/>mass >= 0.5?}
  Drop -->|yes| Skip[Drop question]
  Drop -->|no| Keep[Keep in applicable set]
  Skip --> Mean
  Keep --> Mean[Weighted mean<br/>or strict all-or-nothing]
  Mean --> Fin[finalize<br/>success = score >= threshold]
  Fin --> Out[score + reason + scoreBreakdown]
```

### End-to-end sequence

```mermaid
sequenceDiagram
  participant You
  participant Eval as evaluate()
  participant Metric as Metric
  participant Judge as SystemOneJudge
  participant Report as Report

  You->>Eval: testCases + metrics
  loop each test case
    loop each metric
      Eval->>Metric: measure(testCase)
      Metric->>Metric: build state from fields
      Metric->>Judge: decide(state, questions)
      Judge-->>Metric: probabilities per question
      Metric->>Metric: map to weighted score
      Metric-->>Eval: MetricResult
    end
    Eval->>Eval: case PASS if all metrics pass
  end
  Eval-->>You: EvaluationReport
  You->>Report: writeHtmlReport optional
```

## Quick start

### 1. Custom JevEval (deterministic question checklist)

```typescript
import {
  JevEval, Noul, Score, Choice, SingleTurnParams,
  LLMTestCase, ToolCall, evaluate,
} from "@deepeval-framework/core";

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
    new Score({
      question: "How much of actual_output is grounded in tools_called?",
      levels: ["Fabricated", "Mostly fabricated", "Mostly grounded", "Fully grounded"],
    }),
    new Choice({
      question: "What did actual_output do with info tools did not return?",
      options: {
        left_it_out: 1.0,
        flagged_it_as_unknown: 1.0,
        hedged_it: 0.5,
        stated_it_as_fact: 0.0,
        nothing_missing: null, // drops the question if N/A
      },
    }),
  ],
});

await evaluate(
  new LLMTestCase({
    input: "Weather in Paris?",
    actualOutput: "18°C and sunny.",
    toolsCalled: [
      new ToolCall({
        name: "get_weather",
        inputParameters: { city: "Paris" },
        output: { temp_c: 18, condition: "sunny" },
      }),
    ],
  }),
  [toolFaithfulness],
);
```

### 2. RAG

```typescript
import {
  evaluate, LLMTestCase,
  AnswerRelevancyMetric, FaithfulnessMetric,
  ContextualRelevancyMetric, ContextualRecallMetric, ContextualPrecisionMetric,
} from "@deepeval-framework/core";

await evaluate(
  new LLMTestCase({
    input: "Where is the Eiffel Tower?",
    actualOutput: "In Paris, France.",
    expectedOutput: "Paris, France",
    retrievalContext: ["The Eiffel Tower is located in Paris, France."],
  }),
  [
    new AnswerRelevancyMetric(),
    new FaithfulnessMetric({ threshold: 0.7 }),
    new ContextualRelevancyMetric(),
    new ContextualRecallMetric(),
    new ContextualPrecisionMetric(),
  ],
);
```

### 3. Chatbot (multi-turn)

```typescript
import {
  evaluate, ConversationalTestCase, Turn,
  ConversationCompletenessMetric, KnowledgeRetentionMetric,
  RoleAdherenceMetric, TurnRelevancyMetric,
} from "@deepeval-framework/core";

await evaluate(
  new ConversationalTestCase({
    scenario: "Customer wants a refund",
    expectedOutcome: "Refund confirmed",
    chatbotRole: "Support agent",
    turns: [
      new Turn({ role: "user", content: "I want a refund on order 4471" }),
      new Turn({ role: "assistant", content: "I can help. Confirming order 4471…" }),
    ],
  }),
  [
    new ConversationCompletenessMetric(),
    new KnowledgeRetentionMetric(),
    new RoleAdherenceMetric(),
    new TurnRelevancyMetric(),
  ],
);
```

### 4. Agents / tools

```typescript
import {
  evaluate, LLMTestCase, ToolCall,
  TaskCompletionMetric, ToolCorrectnessMetric,
  ToolFaithfulnessMetric, ArgumentCorrectnessMetric,
} from "@deepeval-framework/core";

await evaluate(/* ... */, [
  new TaskCompletionMetric(),
  new ToolCorrectnessMetric(),
  new ToolFaithfulnessMetric(),
  new ArgumentCorrectnessMetric(),
]);
```

## Question types (JevEval)

| Type | Use when | Value |
|------|----------|-------|
| `Noul` | Yes/no proposition | `P(true)` |
| `Score` | Ordered scale, **worst → best** | Expected level / (n−1) |
| `Choice` | Discrete behaviours; `null` credit = N/A | Credit-weighted probs |

**Score** = weighted mean over applicable questions. **Strict mode** = all applicable questions must hit their best answer.

## Judges

| Judge | Purpose |
|-------|---------|
| `HeuristicSystemOneJudge` (default) | Offline CI — lexical heuristics, no API key |
| Custom `SystemOneJudge` | Plug in Typesafe/Jev or your own decide API |
| `OpenAiCompatibleJudge` | G-Eval LLM-as-judge (`OPENAI_API_KEY`) |

```typescript
import { HeuristicSystemOneJudge, FaithfulnessMetric } from "@deepeval-framework/core";

new FaithfulnessMetric({ systemOneModel: new HeuristicSystemOneJudge() });
```

## Metric catalogue

| Domain | Metrics |
|--------|---------|
| **RAG** | `AnswerRelevancyMetric`, `FaithfulnessMetric`, `ContextualRelevancyMetric`, `ContextualRecallMetric`, `ContextualPrecisionMetric` |
| **Chatbot** | `ConversationCompletenessMetric`, `KnowledgeRetentionMetric`, `RoleAdherenceMetric`, `TurnRelevancyMetric`, `TopicAdherenceMetric` |
| **Agent** | `TaskCompletionMetric`, `ToolCorrectnessMetric`, `ToolFaithfulnessMetric`, `ArgumentCorrectnessMetric`, `StepEfficiencyMetric` |
| **Safety** | `HallucinationMetric`, `ToxicityMetric`, `BiasMetric`, `PiiLeakageMetric`, `PromptAlignmentMetric` |
| **Custom** | `JevEval`, `ConversationalJevEval`, `GEval` |
| **Deterministic** | `JsonCorrectnessMetric`, `ExactMatchMetric`, `TokenF1Metric` |

## Examples

```bash
npm run examples:jev
npm run examples:rag
npm run examples:chatbot
npm run examples:agent
```

## JevEval vs GEval

- **JevEval** — you write the questions; calibrated / heuristic probabilities; same inputs → same score & reason. Best for regression suites.
- **GEval** — one-line `criteria`; an LLM invents steps and scores. Best for exploratory / soft criteria. Needs `OPENAI_API_KEY`.

## Roadmap ideas

- Native Typesafe Jev HTTP client behind `SystemOneJudge`
- Trace / `@observe` trajectory mode
- Vitest matcher helpers (`expect(metric).toPass()`)
- Multi-modal test cases

## License

MIT
