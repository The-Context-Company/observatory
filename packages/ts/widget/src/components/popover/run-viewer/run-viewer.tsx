import { selectedRunSignal } from "@/state";
import { EnrichedUIStep, UIToolCall } from "@/types";
import { cn } from "@/utils/cn";
import { getMsToFinish, nanosToSeconds } from "@/utils/time";
import { signal, useSignal } from "@preact/signals";
import { ChevronDown, Hammer, MessageSquare } from "lucide-preact";
import { RunHeader } from "./run-header";
import { popoverDimensionSignal } from "@/state";
import { SelectedRowDataBlocks } from "./selected-row-data-blocks";
import ContextMenu from "@/components/context-menu";
import DataBlock from "@/components/data-block";

const selectedRowSignal = signal<EnrichedUIStep | UIToolCall | null>(null);

const MIN_HEIGHT = 0;

const SelectedRowViewer = () => {
  const height = useSignal<number>(popoverDimensionSignal.value.height * 0.5);
  const isDragging = useSignal<boolean>(false);

  const selectedRow = selectedRowSignal.value;
  if (!selectedRow) return null;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isDragging.value = true;

    const startY = e.clientY;
    const startHeight = height.value;

    const MAX_HEIGHT = popoverDimensionSignal.value.height * 0.85;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, startHeight + deltaY)
      );
      if (newHeight < 5) {
        selectedRowSignal.value = null;
        height.value = popoverDimensionSignal.value.height * 0.5;
      } else height.value = newHeight;
    };

    const handleMouseUp = () => {
      isDragging.value = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="w-full flex flex-col gap-2 border-t bg-gray-50 border-gray-300 shrink-0"
      style={{ height: `${height.value}px` }}
    >
      <div
        className={cn(
          "w-full h-1.5 cursor-ns-resize hover:bg-blue-500 transition-colors flex items-center justify-center group",
          isDragging.value && "bg-blue-500"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full group-hover:bg-blue-500 transition-colors" />
      </div>
      <div className="px-4 pb-4 overflow-y-auto flex-1 pt-3">
        <SelectedRowDataBlocks row={selectedRow} />
      </div>
    </div>
  );
};

export default function RunViewer() {
  const run = selectedRunSignal.value;
  if (!run) return null;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
        <RunHeader run={run} />
        <DataBlock label="Prompt" content={run.prompt} showDropdown collapsed />
        <DataBlock
          label="Response"
          content={run.response}
          showDropdown
          collapsed
        />
        <StepsViewer steps={run.steps} />
      </div>
      <SelectedRowViewer />
    </div>
  );
}

function StepsViewer({ steps }: { steps: EnrichedUIStep[] }) {
  return (
    <div className="bg-card rounded-lg border border-gray-300">
      {steps.map((step, index) => (
        <Step key={step.spanId} step={step} stepNumber={index + 1} />
      ))}
    </div>
  );
}

export const Step = ({
  step,
  stepNumber,
}: {
  step: EnrichedUIStep;
  stepNumber: number;
}) => {
  const stepExpandedSignal = useSignal(true);
  const isSelected = selectedRowSignal.value === step;
  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors cursor-pointer"
        )}
        onClick={() => (stepExpandedSignal.value = !stepExpandedSignal.value)}
        key={step.spanId}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ChevronDown
            className={cn("w-3 h-3", !stepExpandedSignal.value && "-rotate-90")}
          />
          <p className="text-sm font-medium">Step {stepNumber}</p>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <p className="font-mono">{nanosToSeconds(step.durationNs)}s</p>
        </div>
      </div>
      {stepExpandedSignal.value && (
        <>
          <div
            onClick={() => (selectedRowSignal.value = step)}
            className={cn(isSelected && "bg-")}
          >
            <ContextMenu
              items={[
                {
                  label: "Copy generated text",
                  onClick: () => {
                    navigator.clipboard.writeText(step.response);
                  },
                  disabled: !step.response,
                },
              ]}
            >
              <LLMCallRow enrichedStep={step} />
            </ContextMenu>
          </div>
          {step.toolCalls.map((toolCall) => (
            <div
              key={toolCall.spanId}
              onClick={() => (selectedRowSignal.value = toolCall)}
            >
              <ContextMenu
                items={[
                  {
                    label: "Copy tool call input",
                    onClick: () => {
                      navigator.clipboard.writeText(toolCall.toolArgs);
                    },
                    disabled: !toolCall.toolArgs,
                  },
                  {
                    label: "Copy tool call output",
                    onClick: () => {
                      navigator.clipboard.writeText(toolCall.toolResult);
                    },
                    disabled: !toolCall.toolResult,
                  },
                ]}
              >
                <ToolCallRow key={toolCall.spanId} toolCall={toolCall} />
              </ContextMenu>
            </div>
          ))}
        </>
      )}
    </>
  );
};

function LLMCallRow({ enrichedStep }: { enrichedStep: EnrichedUIStep }) {
  const depth = 1;
  const text = enrichedStep.response;

  const msToFinish = getMsToFinish(enrichedStep.attributes);
  const durationSeconds = msToFinish ? (msToFinish / 1_000).toFixed(3) : null;

  const isSelected = selectedRowSignal.value === enrichedStep;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors cursor-pointer border-l-2",
        isSelected ? "bg-gray-100 border-l-black" : "border-l-transparent"
      )}
      style={{ paddingLeft: `${12 + depth * 24}px` }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-5" />

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center bg-gray-100"
              )}
            >
              <MessageSquare className={cn("w-3 h-3")} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <p>LLM Call</p>
            </div>
          </div>
          {text && (
            <span className="ml-8 font-mono text-xs text-gray-500 line-clamp-1 text-ellipsis">
              {text}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="font-mono text-gray-500">
          {/* TODO: proper fallbacks for tokens */}
          {`${enrichedStep.attributes["ai.usage.totalTokens"]} tokens`}
        </div>
        <div className="font-mono text-gray-500">
          {durationSeconds && `${durationSeconds}s`}
        </div>
      </div>
    </div>
  );
}

function ToolCallRow({ toolCall }: { toolCall: UIToolCall }) {
  const depth = 1;
  const hasError = toolCall.statusCode === 2;
  const isSelected = selectedRowSignal.value === toolCall;
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors cursor-pointer border-l-2 border-transparent",
        isSelected
          ? "bg-gray-100 border-l-black"
          : hasError && "bg-red-100 border-l-red-600",
        depth > 0 && "bg-muted/20"
      )}
      style={{ paddingLeft: `${12 + depth * 24}px` }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-5" />

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center",
                hasError ? "bg-red-100" : "bg-blue-100"
              )}
            >
              <Hammer
                className={cn(
                  "w-3 h-3",
                  hasError ? "text-red-600" : "text-blue-600"
                )}
              />
            </div>

            <div className="min-w-0 flex-1 flex-col text-sm">
              <p>{toolCall.toolName}</p>
            </div>
          </div>
          {toolCall.toolResult && (
            <div className="overflow-hidden w-full px-3">
              <span className="ml-8 font-mono text-xs text-gray-500 line-clamp-1 text-ellipsis break-before-all">
                {toolCall.toolResult}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="font-mono text-gray-500">
          {nanosToSeconds(toolCall.durationNs, 5)}s
        </div>
      </div>
    </div>
  );
}
