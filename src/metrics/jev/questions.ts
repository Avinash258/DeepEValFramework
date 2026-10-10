export interface QuestionBaseOptions {
  weight?: number;
}

export class Noul {
  readonly kind = "noul" as const;
  readonly statement: string;
  readonly weight: number;
  readonly trueDescription?: string;
  readonly falseDescription?: string;

  constructor(
    options: QuestionBaseOptions & {
      statement: string;
      trueDescription?: string;
      falseDescription?: string;
    },
  ) {
    this.statement = options.statement;
    this.weight = options.weight ?? 1;
    this.trueDescription = options.trueDescription;
    this.falseDescription = options.falseDescription;
  }
}

export class Score {
  readonly kind = "score" as const;
  readonly question: string;
  readonly levels: string[];
  readonly weight: number;

  constructor(
    options: QuestionBaseOptions & {
      question: string;
      levels: string[];
    },
  ) {
    if (options.levels.length < 2 || options.levels.length > 10) {
      throw new Error("Score levels must have between 2 and 10 entries (worst first).");
    }
    this.question = options.question;
    this.levels = options.levels;
    this.weight = options.weight ?? 1;
  }
}

export class Choice {
  readonly kind = "choice" as const;
  readonly question: string;
  /** Credit in [0,1] or null = not applicable. */
  readonly options: Record<string, number | null>;
  readonly weight: number;

  constructor(
    options: QuestionBaseOptions & {
      question: string;
      options: Record<string, number | null>;
    },
  ) {
    if (!Object.keys(options.options).length) {
      throw new Error("Choice requires at least one option.");
    }
    this.question = options.question;
    this.options = options.options;
    this.weight = options.weight ?? 1;
  }
}

export type JevQuestion = Noul | Score | Choice;
