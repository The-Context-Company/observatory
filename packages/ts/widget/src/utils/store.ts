import { EnrichedUIRun, EnrichedUIStep, UIStep, UIToolCall } from "@/types";
import { NewItems, TCCStore } from "../hooks/useSyncTCCStore";
import { debug } from "@/internal/logger";

export const reconcileStore = (
  prev: TCCStore,
  newItems: NewItems
): TCCStore => {
  const { runs, steps, toolCalls } = newItems;
  const newStore = { ...prev };
  for (const run of runs) {
    if (newStore[run.traceId]) {
      newStore[run.traceId].run = run;
    } else {
      newStore[run.traceId] = {
        run,
        steps: [],
        toolCalls: [],
      };
    }
  }

  for (const step of steps) {
    if (newStore[step.traceId]) {
      newStore[step.traceId].steps.push(step);
    } else {
      newStore[step.traceId] = {
        run: null,
        steps: [step],
        toolCalls: [],
      };
    }
  }

  for (const toolCall of toolCalls) {
    if (newStore[toolCall.traceId]) {
      newStore[toolCall.traceId].toolCalls.push(toolCall);
    } else {
      newStore[toolCall.traceId] = {
        run: null,
        steps: [],
        toolCalls: [toolCall],
      };
    }
  }

  return newStore;
};

const isStep = (span: UIStep | UIToolCall): span is UIStep => {
  return !("toolName" in span);
};

export const getEnrichedRun = (
  trace: TCCStore[string]
): EnrichedUIRun | null => {
  if (!trace) return null;

  const { run, steps, toolCalls } = trace;
  if (!run) return null;

  const stepsAndToolCalls = [...steps, ...toolCalls].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  const enrichedSteps = [];
  let lastStep: EnrichedUIStep | null = null;

  for (const span of stepsAndToolCalls) {
    if (isStep(span)) {
      if (lastStep) enrichedSteps.push(lastStep);
      lastStep = { ...span, toolCalls: [] };
    } else {
      if (lastStep && isStep(lastStep)) lastStep.toolCalls.push(span);
    }
  }

  if (lastStep) enrichedSteps.push(lastStep);

  return { ...run, steps: enrichedSteps };
};

export const getUserPromptFromPromptAttribute = (prompt: string): string => {
  try {
    const parsed = JSON.parse(prompt);
    if ("prompt" in parsed) return parsed.prompt;
    if ("messages" in parsed) {
      const messages = parsed.messages;
      const lastMessage = messages.at(-1);
      if ("content" in lastMessage) {
        if (Array.isArray(lastMessage.content)) {
          return lastMessage.content
            .map((message: any) =>
              message.type === "text" ? message.text : ""
            )
            .join("\n");
        }
        if (typeof lastMessage.content === "string") {
          return lastMessage.content;
        }
      }
    }
    return prompt;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const truncatedPrompt =
      prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt;
    debug(
      `Failed to extract prompt from attribute: ${errorMsg}. Value: ${truncatedPrompt}`
    );
    return prompt;
  }
};
