import { EnrichedUIRun } from "@/types";
import { formatDate, nanosToSeconds } from "@/utils/time";
import { X } from "lucide-preact";
import { selectedTraceIdSignal } from "@/state";

export const RunHeader = ({ run }: { run: EnrichedUIRun }) => {
  const handleClose = () => {
    selectedTraceIdSignal.value = null;
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="">Agent Run</h1>
        <X className="w-4 h-4 cursor-pointer" onClick={handleClose} />
      </div>

      <div className="flex items-center text-xs text-gray-500 *:px-[min(1rem,1vw)]">
        <div className="font-mono pl-0!">{formatDate(run.startTime)}</div>
        <div className="font-mono">|</div>
        <div className="font-mono">{nanosToSeconds(run.durationNs, 5)}s</div>
        <div className="font-mono">|</div>
        <div className="font-mono">{run.promptTokens} input tokens</div>
        <div className="font-mono">|</div>
        <div className="font-mono pr-0!">
          {run.completionTokens} output tokens
        </div>
      </div>
    </>
  );
};
