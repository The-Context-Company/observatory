import { selectedTraceIdSignal, toolCallsSignal } from "@/state";
import { getAgoString } from "@/utils/time";
import Empty from "./empty";
import { UIToolCall } from "@/types";
import { cn } from "@/utils/cn";
import { captureAnonymousEvent } from "@/internal/events";

export const ToolCallRow = ({
  toolCall,
  // TODO: maybe just compute `failed` with toolCall.statusCode === 2
  failed = false,
}: {
  toolCall: UIToolCall;
  failed?: boolean;
}) => {
  const caption =
    failed && toolCall.statusMessage
      ? toolCall.statusMessage
      : toolCall.toolResult;
  return (
    <div
      className={cn(
        "p-4 transition-colors cursor-pointer",
        failed
          ? "bg-red-100 hover:bg-red-200 border-l-red-500 border-l-2"
          : "bg-gray-50 hover:bg-gray-100"
      )}
      onClick={() => {
        selectedTraceIdSignal.value = toolCall.traceId;
        captureAnonymousEvent({
          event: "row_click_event",
          row_type: "tool_call",
          has_failure: failed ?? false,
        });
      }}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm text-gray-900 font-medium">
          {/* TODO: show icon if we're on failures tab */}
          {toolCall.toolName}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              {toolCall.durationNs / 1_000_000}ms
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              {getAgoString(toolCall.startTime)}
            </span>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "font-mono text-xs mt-0.5 line-clamp-2 text-ellipsis",
          failed ? "text-red-500" : "text-gray-500"
        )}
      >
        {caption}
      </div>
    </div>
  );
};

export default function ToolCallsList() {
  const toolCalls = toolCallsSignal.value;

  if (toolCalls.length === 0) {
    return <Empty label="No tool calls found" />;
  }

  return (
    <div className="text-sm text-gray-500 divide-y divide-gray-200">
      {toolCalls.map((toolCall) => (
        <ToolCallRow
          key={toolCall.traceId}
          toolCall={toolCall}
          failed={toolCall.statusCode === 2}
        />
      ))}
    </div>
  );
}
