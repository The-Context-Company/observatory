import { FailedRun, FailedToolCall, failuresSignal } from "@/state";
import Empty from "@/components/popover/empty";
import { ToolCallRow } from "./tool-calls-list";
import { RunRow } from "./runs-list";

const isToolCall = (
  failure: FailedToolCall | FailedRun
): failure is FailedToolCall => {
  return failure.type === "toolCall";
};

export default function FailuresList() {
  const failures = failuresSignal.value;

  if (failures.length === 0) {
    return <Empty label="No failures found 🎉" />;
  }

  return (
    <div className="text-sm text-gray-500 divide-y divide-gray-200">
      {failures.map((failure) =>
        isToolCall(failure) ? (
          <ToolCallRow key={failure.traceId} toolCall={failure} failed />
        ) : (
          <RunRow key={failure.traceId} run={failure as FailedRun} failed />
        )
      )}
    </div>
  );
}
