import { computed, signal } from "@preact/signals";
import { TCCStore } from "@/hooks/useSyncTCCStore";
import { Corner } from "@/utils/corners";
import { UIRun, UIToolCall } from "./types";
import { getEnrichedRun } from "./utils/store";
import { UNDOCKED_HEIGHT, UNDOCKED_WIDTH } from "./constants";

// Widget UI
export const widgetExpandedSignal = signal(false);
export const widgetPositionSignal = signal<{ x: number; y: number }>({
  x: 0,
  y: 0,
});
export const widgetCornerSignal = signal<Corner>("top-right");
export const widgetDimensionsSignal = signal<{ width: number; height: number }>(
  {
    width: UNDOCKED_WIDTH,
    height: UNDOCKED_HEIGHT,
  }
);

export type DockedMode = "left" | "right" | "top" | "bottom";
export const widgetDockedSignal = signal<DockedMode | null>(null);
export const hasUnseenFailuresSignal = signal(false);

// Popover UI
export const popoverDimensionSignal = signal<{ width: number; height: number }>(
  {
    width: 630,
    height: 400,
  }
);
export const selectedTraceIdSignal = signal<string | null>(null);
export const selectedRunSignal = computed(() => {
  const trace = tccStoreSignal.value[selectedTraceIdSignal.value ?? ""];
  return getEnrichedRun(trace);
});

// Store
export const tccStoreSignal = signal<TCCStore>({});
export const runsSignal = computed(() =>
  Object.values(tccStoreSignal.value)
    .map(({ run }) => run)
    .filter((r) => r !== null)
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
);
export const toolCallsSignal = computed(() =>
  Object.values(tccStoreSignal.value)
    .map(({ toolCalls }) => toolCalls)
    .flat()
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
);

export type FailedToolCall = UIToolCall & { type: "toolCall" };
export type FailedRun = UIRun & { type: "run" };
export const failuresSignal = computed(() => {
  const store = tccStoreSignal.value;

  const runs = Object.values(store)
    .map(({ run }) => run)
    .filter((r) => r !== null)
    .map((run) => ({ ...run, type: "run" })) as FailedRun[];

  const toolCalls = Object.values(store)
    .map(({ toolCalls }) => toolCalls)
    .flat()
    .map((toolCall) => ({ ...toolCall, type: "toolCall" })) as FailedToolCall[];

  return [...runs, ...toolCalls]
    .filter((item) => item.statusCode === 2)
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
});

// Dropdown & Context Menu
export const openContextMenuIdSignal = signal<string | null>(null);
