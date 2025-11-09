import { runsSignal, selectedTraceIdSignal } from "@/state";
import ContextMenu from "@/components/context-menu";
import { getAgoString } from "@/utils/time";
import Empty from "@/components/popover/empty";
import { UIRun } from "@/types";
import { cn } from "@/utils/cn";
import { useEffect, useRef } from "preact/hooks";

// TODO: maybe just compute `failed` with run.statusCode === 2
export const RunRow = ({ run, failed }: { run: UIRun; failed?: boolean }) => {
  const items = [
    {
      label: "Copy prompt",
      onClick: () => {
        navigator.clipboard.writeText(run.prompt);
      },
    },
    {
      label: "Copy response",
      onClick: () => {
        navigator.clipboard.writeText(run.response);
      },
    },
  ];
  const caption =
    failed && run.statusMessage ? run.statusMessage : run.response;

  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => {
      if (divRef.current) divRef.current.style.backgroundColor = "white";
    }, 300);
  }, []);

  return (
    <ContextMenu items={items}>
      <div
        ref={divRef}
        key={run.traceId}
        className={cn(
          "p-4 transition-colors cursor-pointer",
          failed
            ? "bg-red-100 hover:bg-red-200"
            : "bg-gray-50 hover:bg-gray-100",
          "bg-blue-100 transition-colors duration-300 ease-in-out",
          "hover:bg-gray-100!"
        )}
        onClick={() => {
          selectedTraceIdSignal.value = run.traceId;
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-mono text-sm text-gray-900 font-medium">
            Agent Run
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">
                {run.promptTokens + run.completionTokens} tokens
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">
                {run.durationNs / 1_000_000}ms
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">
                {getAgoString(run.startTime)}
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
    </ContextMenu>
  );
};

export default function RunsList() {
  const runs = runsSignal.value;

  if (runs.length === 0) {
    return <Empty label="No runs found" />;
  }

  return (
    <div className="text-sm text-gray-500 divide-y divide-gray-200">
      {runs.map((run) => (
        <RunRow key={run.traceId} run={run} failed={run.statusCode === 2} />
      ))}
    </div>
  );
}
