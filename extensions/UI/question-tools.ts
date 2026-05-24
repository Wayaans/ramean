import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

interface QuestionOption {
  label: string;
  description?: string;
}

interface QuestionToolParams {
  question: string;
  options: QuestionOption[];
  allowOther?: boolean;
  otherLabel?: string;
}

interface QuestionDetails {
  question: string;
  options: string[];
  answer: string | null;
  wasCustom?: boolean;
}

interface QuestionnaireOption {
  value: string;
  label: string;
  description?: string;
}

interface QuestionnaireQuestion {
  id: string;
  label: string;
  prompt: string;
  options: QuestionnaireOption[];
  allowOther: boolean;
  otherLabel?: string;
}

interface Answer {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  index?: number;
}

interface InteractiveChoice {
  value: string;
  label: string;
  description?: string;
}

interface InteractiveQuestion {
  id: string;
  label: string;
  prompt: string;
  options: InteractiveChoice[];
  allowOther: boolean;
  otherLabel?: string;
}

interface InteractiveAnswer extends Answer {}

interface InteractiveResult {
  questions: InteractiveQuestion[];
  answers: InteractiveAnswer[];
  cancelled: boolean;
}

export interface QuestionnaireResult {
  questions: QuestionnaireQuestion[];
  answers: Answer[];
  cancelled: boolean;
}

type RenderChoice = InteractiveChoice & { isOther?: boolean };

const QuestionOptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(Type.String({ description: "Optional helper text shown below the option" })),
});

const QuestionParams = Type.Object({
  question: Type.String({ description: "The question to ask the user" }),
  options: Type.Array(QuestionOptionSchema, { description: "Options for the user to choose from" }),
  allowOther: Type.Optional(Type.Boolean({ description: "Allow a freeform answer entry (default: true)" })),
  otherLabel: Type.Optional(
    Type.String({ description: "Custom label for the freeform answer option (default: Write your own answer)" }),
  ),
}) as any;

const QuestionnaireOptionSchema = Type.Object({
  value: Type.String({ description: "The value returned when selected" }),
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(Type.String({ description: "Optional helper text shown below the option" })),
});

const QuestionnaireQuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(
    Type.String({ description: "Short label shown in the step bar, e.g. Scope, Priority, Style" }),
  ),
  prompt: Type.String({ description: "The full question text to display" }),
  options: Type.Array(QuestionnaireOptionSchema, { description: "Available options to choose from" }),
  allowOther: Type.Optional(Type.Boolean({ description: "Allow a freeform answer entry (default: true)" })),
  otherLabel: Type.Optional(
    Type.String({ description: "Custom label for the freeform answer option (default: Write your own answer)" }),
  ),
}) as any;

const QuestionnaireParams = Type.Object({
  questions: Type.Array(QuestionnaireQuestionSchema, {
    description: "Questions to ask the user",
  }),
}) as any;

const DEFAULT_OTHER_LABEL = "Write your own answer";

export function registerQuestionTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "question",
    label: "question",
    description:
      "Ask the user one interactive clarification question with polished multiple-choice UI and optional freeform answer entry.",
    promptSnippet: "Ask a single interactive clarification question with curated options and optional freeform input.",
    promptGuidelines: [
      "Use question when exactly one blocking decision or clarification is needed from the user.",
      "Keep options crisp and mutually exclusive. The tool already offers a freeform path when needed.",
    ],
    parameters: QuestionParams,
    async execute(_toolCallId, params: any, _signal, _onUpdate, ctx) {
      const input = params as QuestionToolParams;
      const allowOther = input.allowOther !== false;
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "Error: question requires interactive UI mode" }],
          details: {
            question: input.question,
            options: input.options.map((option) => option.label),
            answer: null,
          } satisfies QuestionDetails,
        };
      }

      if (input.options.length === 0 && !allowOther) {
        return {
          content: [{ type: "text", text: "Error: question needs at least one option or allowOther=true" }],
          details: {
            question: input.question,
            options: [],
            answer: null,
          } satisfies QuestionDetails,
        };
      }

      const interactiveQuestion: InteractiveQuestion = {
        id: "question",
        label: "Decision",
        prompt: input.question,
        options: input.options.map((option) => ({
          value: option.label,
          label: option.label,
          description: option.description,
        })),
        allowOther,
        otherLabel: input.otherLabel,
      };

      const result = await askInteractiveQuestions(ctx, [interactiveQuestion]);
      const answer = result.answers[0];
      const details: QuestionDetails = {
        question: input.question,
        options: input.options.map((option) => option.label),
        answer: answer?.label ?? null,
        wasCustom: answer?.wasCustom,
      };

      if (result.cancelled || !answer) {
        return {
          content: [{ type: "text", text: "User cancelled the question" }],
          details,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: answer.wasCustom ? `User wrote: ${answer.label}` : `User selected: ${answer.index}. ${answer.label}`,
          },
        ],
        details,
      };
    },
    renderCall(args, theme) {
      const input = args as QuestionToolParams;
      const optionLabels = input.options.map((option) => option.label);
      const summary = optionLabels.length > 0 ? optionLabels.join(", ") : "freeform only";
      let text = theme.fg("toolTitle", theme.bold("question ")) + theme.fg("muted", input.question);
      text += "\n";
      text += theme.fg(
        "dim",
        `  ${optionLabels.length} option${optionLabels.length === 1 ? "" : "s"}${input.allowOther === false ? "" : " + custom answer"} · ${truncateToWidth(summary, 72)}`,
      );
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionDetails | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }
      if (details.answer === null) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }
      if (details.wasCustom) {
        return new Text(
          `${theme.fg("success", "✦")} ${theme.fg("muted", "custom answer")} ${theme.fg("accent", details.answer)}`,
          0,
          0,
        );
      }
      const index = details.options.indexOf(details.answer) + 1;
      const display = index > 0 ? `${index}. ${details.answer}` : details.answer;
      return new Text(`${theme.fg("success", "✓")} ${theme.fg("accent", display)}`, 0, 0);
    },
  });

  pi.registerTool({
    name: "questionnaire",
    label: "questionnaire",
    description:
      "Ask the user a multi-step interactive questionnaire with progress, step navigation, answer review, and optional freeform answers.",
    promptSnippet: "Ask a multi-step interactive questionnaire when several structured answers are needed from the user.",
    promptGuidelines: [
      "Use questionnaire when you need two or more related answers before proceeding.",
      "Prefer short step labels and compact, high-signal options for each question.",
    ],
    parameters: QuestionnaireParams,
    async execute(_toolCallId, params: any, _signal, _onUpdate, ctx) {
      const input = params as { questions: Array<Partial<QuestionnaireQuestion>> };
      if (!ctx.hasUI) {
        return errorQuestionnaireResult("Error: questionnaire requires interactive UI mode");
      }
      if (input.questions.length === 0) {
        return errorQuestionnaireResult("Error: no questions provided");
      }

      const questions = input.questions.map((question, index) => ({
        id: typeof question.id === "string" && question.id.trim() ? question.id : `q${index + 1}`,
        label: typeof question.label === "string" && question.label.trim() ? question.label.trim() : `Q${index + 1}`,
        prompt: typeof question.prompt === "string" ? question.prompt : "",
        options: Array.isArray(question.options)
          ? question.options
              .filter(
                (option): option is QuestionnaireOption =>
                  Boolean(option && typeof option.label === "string" && typeof option.value === "string"),
              )
              .map((option) => ({
                value: option.value,
                label: option.label,
                description: option.description,
              }))
          : [],
        allowOther: question.allowOther !== false,
        otherLabel: question.otherLabel,
      } satisfies InteractiveQuestion));

      const invalidQuestion = questions.find((question) => question.options.length === 0 && !question.allowOther);
      if (invalidQuestion) {
        return errorQuestionnaireResult(
          `Error: question "${invalidQuestion.label}" needs at least one option or allowOther=true`,
          questions,
        );
      }

      const result = await askInteractiveQuestions(ctx, questions);
      const details: QuestionnaireResult = {
        questions: result.questions.map((question) => ({
          id: question.id,
          label: question.label,
          prompt: question.prompt,
          options: question.options.map((option) => ({
            value: option.value,
            label: option.label,
            description: option.description,
          })),
          allowOther: question.allowOther,
          otherLabel: question.otherLabel,
        })),
        answers: result.answers,
        cancelled: result.cancelled,
      };

      if (result.cancelled) {
        return {
          content: [{ type: "text", text: "User cancelled the questionnaire" }],
          details,
        };
      }

      const summaryLines = result.questions.map((question) => {
        const answer = result.answers.find((candidate) => candidate.id === question.id);
        if (!answer) {
          return `${question.label}: unanswered`;
        }
        return answer.wasCustom
          ? `${question.label}: user wrote ${answer.label}`
          : `${question.label}: user selected ${answer.index}. ${answer.label}`;
      });

      return {
        content: [{ type: "text", text: summaryLines.join("\n") }],
        details,
      };
    },
    renderCall(args, theme) {
      const input = args as { questions?: Array<{ label?: string; id?: string }> };
      const questions = input.questions ?? [];
      const labels = questions.map((question, index) => question.label || question.id || `Q${index + 1}`).join(", ");
      let text = theme.fg("toolTitle", theme.bold("questionnaire "));
      text += theme.fg("muted", `${questions.length} step${questions.length === 1 ? "" : "s"}`);
      if (labels) {
        text += `\n${theme.fg("dim", `  ${truncateToWidth(labels, 72)}`)}`;
      }
      return new Text(text, 0, 0);
    },
    renderResult(result, _options, theme) {
      const details = result.details as QuestionnaireResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }
      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }

      const answersById = new Map(details.answers.map((answer) => [answer.id, answer] as const));
      const lines = [
        `${theme.fg("success", "✓")} ${theme.fg("accent", `${details.answers.length}/${details.questions.length} answers captured`)}`,
      ];

      for (const question of details.questions) {
        const answer = answersById.get(question.id);
        if (!answer) {
          lines.push(`${theme.fg("warning", "○")} ${theme.fg("muted", question.label)}: unanswered`);
          continue;
        }

        const prefix = answer.wasCustom
          ? `${theme.fg("success", "✦")} ${theme.fg("muted", question.label)}:`
          : `${theme.fg("success", "●")} ${theme.fg("muted", question.label)}:`;
        const suffix = answer.wasCustom ? `${theme.fg("muted", " custom ")}${answer.label}` : `${answer.index}. ${answer.label}`;
        lines.push(`${prefix} ${theme.fg("text", suffix)}`);
      }

      return new Text(lines.join("\n"), 0, 0);
    },
  });
}

function errorQuestionnaireResult(message: string, questions: InteractiveQuestion[] = []) {
  return {
    content: [{ type: "text" as const, text: message }],
    details: {
      questions: questions.map((question) => ({
        id: question.id,
        label: question.label,
        prompt: question.prompt,
        options: question.options.map((option) => ({
          value: option.value,
          label: option.label,
          description: option.description,
        })),
        allowOther: question.allowOther,
        otherLabel: question.otherLabel,
      })),
      answers: [],
      cancelled: true,
    } satisfies QuestionnaireResult,
  };
}

async function askInteractiveQuestions(ctx: ExtensionContext, questions: InteractiveQuestion[]): Promise<InteractiveResult> {
  const normalizedQuestions = questions.map((question, index) => ({
    ...question,
    label: question.label?.trim() ? question.label.trim() : `Q${index + 1}`,
    allowOther: question.allowOther !== false,
    otherLabel: question.otherLabel?.trim() || DEFAULT_OTHER_LABEL,
  }));

  return ctx.ui.custom<InteractiveResult>((tui, theme, _kb, done) => {
    const isMultiStep = normalizedQuestions.length > 1;
    const reviewStepIndex = normalizedQuestions.length;
    const selectedByQuestion = new Map<string, number>(normalizedQuestions.map((question) => [question.id, 0]));
    const answers = new Map<string, InteractiveAnswer>();
    const editor = new Editor(tui, createEditorTheme(theme));

    let currentStep = 0;
    let inputMode = false;
    let inputQuestionId: string | undefined;
    let notice: string | undefined;
    let cachedLines: string[] | undefined;

    editor.onSubmit = (value) => {
      const activeQuestion = normalizedQuestions.find((question) => question.id === inputQuestionId);
      if (!activeQuestion) return;

      const trimmed = value.trim();
      if (!trimmed) {
        notice = "Type an answer or press Esc to go back.";
        refresh();
        return;
      }

      selectedByQuestion.set(activeQuestion.id, getOptionsForQuestion(activeQuestion).length - 1);
      answers.set(activeQuestion.id, {
        id: activeQuestion.id,
        value: trimmed,
        label: trimmed,
        wasCustom: true,
      });

      inputMode = false;
      inputQuestionId = undefined;
      notice = undefined;
      editor.setText("");
      advanceAfterAnswer();
    };

    const refresh = () => {
      cachedLines = undefined;
      tui.requestRender();
    };

    const getOptionsForQuestion = (question: InteractiveQuestion): RenderChoice[] => {
      const options: RenderChoice[] = [...question.options];
      if (question.allowOther) {
        options.push({ value: "__other__", label: question.otherLabel || DEFAULT_OTHER_LABEL, isOther: true });
      }
      return options;
    };

    const isReviewStep = () => isMultiStep && currentStep === reviewStepIndex;
    const getCurrentQuestion = () => (currentStep < normalizedQuestions.length ? normalizedQuestions[currentStep] : undefined);
    const getAnsweredCount = () => normalizedQuestions.filter((question) => answers.has(question.id)).length;
    const allAnswered = () => normalizedQuestions.every((question) => answers.has(question.id));

    const finish = (cancelled: boolean) => {
      const orderedAnswers = normalizedQuestions
        .map((question) => answers.get(question.id))
        .filter((answer): answer is InteractiveAnswer => Boolean(answer));
      done({ questions: normalizedQuestions, answers: orderedAnswers, cancelled });
    };

    const moveStep = (delta: number) => {
      if (!isMultiStep) return;
      const totalSteps = normalizedQuestions.length + 1;
      currentStep = (currentStep + delta + totalSteps) % totalSteps;
      notice = undefined;
      refresh();
    };

    const openCustomAnswer = (question: InteractiveQuestion) => {
      inputMode = true;
      inputQuestionId = question.id;
      notice = undefined;
      editor.setText("");
      refresh();
    };

    const advanceAfterAnswer = () => {
      if (!isMultiStep) {
        finish(false);
        return;
      }

      const nextUnanswered = normalizedQuestions.findIndex(
        (question, index) => index > currentStep && !answers.has(question.id),
      );
      if (nextUnanswered !== -1) {
        currentStep = nextUnanswered;
      } else if (currentStep < normalizedQuestions.length - 1) {
        currentStep += 1;
      } else {
        currentStep = reviewStepIndex;
      }

      notice = undefined;
      refresh();
    };

    const commitSelection = (question: InteractiveQuestion, optionIndex: number) => {
      const options = getOptionsForQuestion(question);
      const selected = options[optionIndex];
      if (!selected) return;

      selectedByQuestion.set(question.id, optionIndex);
      if (selected.isOther) {
        openCustomAnswer(question);
        return;
      }

      answers.set(question.id, {
        id: question.id,
        value: selected.value,
        label: selected.label,
        wasCustom: false,
        index: optionIndex + 1,
      });
      advanceAfterAnswer();
    };

    const handleInput = (data: string) => {
      if (inputMode) {
        if (matchesKey(data, Key.escape)) {
          inputMode = false;
          inputQuestionId = undefined;
          notice = undefined;
          editor.setText("");
          refresh();
          return;
        }
        editor.handleInput(data);
        refresh();
        return;
      }

      if (isMultiStep && (matchesKey(data, Key.tab) || matchesKey(data, Key.right))) {
        moveStep(1);
        return;
      }
      if (isMultiStep && (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left))) {
        moveStep(-1);
        return;
      }

      if (isReviewStep()) {
        if (matchesKey(data, Key.enter)) {
          if (allAnswered()) {
            finish(false);
          } else {
            notice = "Finish the remaining questions before submitting.";
            refresh();
          }
          return;
        }
        if (matchesKey(data, Key.escape)) {
          finish(true);
        }
        return;
      }

      const question = getCurrentQuestion();
      if (!question) {
        finish(true);
        return;
      }

      const options = getOptionsForQuestion(question);
      const selectedIndex = selectedByQuestion.get(question.id) ?? 0;
      const quickPick = parseNumericSelection(data, options.length);
      if (quickPick !== undefined) {
        commitSelection(question, quickPick);
        return;
      }

      if (matchesKey(data, Key.up)) {
        if (options.length > 0) {
          selectedByQuestion.set(question.id, Math.max(0, selectedIndex - 1));
          notice = undefined;
          refresh();
        }
        return;
      }

      if (matchesKey(data, Key.down)) {
        if (options.length > 0) {
          selectedByQuestion.set(question.id, Math.min(options.length - 1, selectedIndex + 1));
          notice = undefined;
          refresh();
        }
        return;
      }

      if (matchesKey(data, Key.enter)) {
        commitSelection(question, selectedIndex);
        return;
      }

      if (matchesKey(data, Key.escape)) {
        finish(true);
      }
    };

    const render = (width: number): string[] => {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const add = (line = "") => lines.push(truncateToWidth(line, width));
      const activeQuestion = getCurrentQuestion();
      const answeredCount = getAnsweredCount();
      const panelTitle = isMultiStep ? "◆ Interactive questionnaire" : "◆ Quick question";
      const panelMeta = isMultiStep
        ? `${answeredCount}/${normalizedQuestions.length} answered`
        : `${activeQuestion ? getOptionsForQuestion(activeQuestion).length : 0} options`;

      add(theme.fg("accent", "─".repeat(Math.max(1, width))));
      pushWrappedLine(
        lines,
        `${theme.fg("accent", theme.bold(panelTitle))}${theme.fg("muted", ` · ${panelMeta}`)}`,
        width,
      );

      if (isMultiStep) {
        const progressLabel = isReviewStep() ? "review & submit" : `step ${currentStep + 1}/${normalizedQuestions.length}`;
        pushWrappedLine(
          lines,
          `${buildProgressBar(answeredCount, normalizedQuestions.length, width, theme)} ${theme.fg("muted", progressLabel)}`,
          width,
          " ",
        );
        add("");
        const chips = normalizedQuestions
          .map((question, index) => formatStepChip(question.label, index === currentStep, answers.has(question.id), theme))
          .join(" ");
        pushWrappedLine(lines, `${chips} ${formatReviewChip(isReviewStep(), allAnswered(), theme)}`, width, " ");
        add("");
      }

      if (isReviewStep()) {
        pushWrappedLine(lines, theme.fg("accent", theme.bold("Review your answers")), width, " ");
        add("");

        for (const question of normalizedQuestions) {
          const answer = answers.get(question.id);
          if (!answer) {
            pushWrappedLine(
              lines,
              `${theme.fg("warning", "○")} ${theme.fg("muted", question.label)} ${theme.fg("warning", "still unanswered")}`,
              width,
              " ",
            );
            continue;
          }

          const detail = answer.wasCustom ? `${theme.fg("muted", "✎ custom")} ${answer.label}` : `${answer.index}. ${answer.label}`;
          pushWrappedLine(
            lines,
            `${theme.fg("success", "●")} ${theme.fg("muted", question.label)} ${theme.fg("text", detail)}`,
            width,
            " ",
          );
        }
      } else if (activeQuestion) {
        pushWrappedLine(lines, theme.fg("text", activeQuestion.prompt), width, " ");
        add("");

        const options = getOptionsForQuestion(activeQuestion);
        const selectedIndex = selectedByQuestion.get(activeQuestion.id) ?? 0;
        const currentAnswer = answers.get(activeQuestion.id);

        for (let index = 0; index < options.length; index += 1) {
          const option = options[index];
          const selected = !inputMode && index === selectedIndex;
          const chosen = currentAnswer?.wasCustom
            ? Boolean(option.isOther)
            : currentAnswer?.value === option.value && currentAnswer?.label === option.label;

          const marker = selected
            ? theme.fg("accent", "❯")
            : chosen
              ? theme.fg("success", "●")
              : theme.fg("dim", "•");
          const shortcut = theme.fg(selected ? "accent" : "dim", `[${index + 1}]`);
          const label = selected ? theme.fg("accent", theme.bold(option.label)) : theme.fg("text", option.label);
          const suffix = chosen && !selected ? ` ${theme.fg("success", "chosen")}` : "";
          pushWrappedLine(lines, `${marker} ${shortcut} ${label}${suffix}`, width, " ");

          if (option.description) {
            pushWrappedLine(lines, theme.fg("muted", option.description), width, "     ");
          }
        }

        if (currentAnswer && !inputMode) {
          add("");
          const answerText = currentAnswer.wasCustom
            ? `${theme.fg("success", "Current answer")} ${theme.fg("muted", "✎ custom")} ${theme.fg("text", currentAnswer.label)}`
            : `${theme.fg("success", "Current answer")} ${theme.fg("text", currentAnswer.label)}`;
          pushWrappedLine(lines, answerText, width, " ");
        }

        if (inputMode) {
          add("");
          pushWrappedLine(lines, theme.fg("accent", theme.bold("Custom answer")), width, " ");
          for (const line of editor.render(Math.max(24, width - 2))) {
            add(` ${truncateToWidth(line, Math.max(1, width - 1))}`);
          }
        }

        if (isMultiStep && answeredCount > 0) {
          add("");
          pushWrappedLine(lines, theme.fg("muted", "Live summary"), width, " ");
          for (const question of normalizedQuestions) {
            const answer = answers.get(question.id);
            if (!answer) continue;
            const prefix = answer.wasCustom ? `${question.label}: ${theme.fg("muted", "✎")} ` : `${question.label}: `;
            pushWrappedLine(lines, `${theme.fg("success", "•")} ${theme.fg("text", `${prefix}${answer.label}`)}`, width, "   ");
          }
        }
      }

      if (notice) {
        add("");
        pushWrappedLine(lines, theme.fg("warning", notice), width, " ");
      }

      add("");
      const helpText = inputMode
        ? "Enter submit · Esc go back"
        : isReviewStep()
          ? "Enter submit · Tab/←→ navigate · Esc cancel"
          : isMultiStep
            ? "1-9 quick pick · ↑↓ choose · Enter confirm · Tab/←→ step · Esc cancel"
            : "1-9 quick pick · ↑↓ choose · Enter confirm · Esc cancel";
      pushWrappedLine(lines, theme.fg("dim", helpText), width, " ");
      add(theme.fg("accent", "─".repeat(Math.max(1, width))));

      cachedLines = lines;
      return lines;
    };

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}

function createEditorTheme(theme: any): EditorTheme {
  return {
    borderColor: (text) => theme.fg("accent", text),
    selectList: {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    },
  };
}

function parseNumericSelection(data: string, optionCount: number): number | undefined {
  if (data.length !== 1 || !/^[1-9]$/.test(data)) return undefined;
  const value = Number(data) - 1;
  return value >= 0 && value < optionCount ? value : undefined;
}

function pushWrappedLine(lines: string[], text: string, width: number, indent = ""): void {
  const availableWidth = Math.max(1, width - visibleWidth(indent));
  for (const line of wrapTextWithAnsi(text, availableWidth)) {
    lines.push(truncateToWidth(`${indent}${line}`, width));
  }
}

function buildProgressBar(completed: number, total: number, width: number, theme: any): string {
  const barWidth = Math.max(8, Math.min(18, Math.floor(width / 3)));
  const ratio = total === 0 ? 0 : completed / total;
  const filled = Math.max(0, Math.min(barWidth, Math.round(barWidth * ratio)));
  return `${theme.fg("accent", "█".repeat(filled))}${theme.fg("dim", "░".repeat(barWidth - filled))}`;
}

function formatStepChip(label: string, active: boolean, answered: boolean, theme: any): string {
  const compactLabel = truncateToWidth(label, 12, "…");
  const text = ` ${answered ? "●" : "○"} ${compactLabel} `;
  if (active) {
    return theme.bg("selectedBg", theme.fg("text", text));
  }
  return theme.fg(answered ? "success" : "muted", text);
}

function formatReviewChip(active: boolean, ready: boolean, theme: any): string {
  const text = ` ${ready ? "✓" : "…"} Review `;
  if (active) {
    return theme.bg("selectedBg", theme.fg("text", text));
  }
  return theme.fg(ready ? "accent" : "dim", text);
}
