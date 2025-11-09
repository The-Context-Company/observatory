import { useEffect } from "preact/hooks";
import { UIRun, UIStep, UIToolCall } from "../types";
import { reconcileStore } from "@/utils/store";
import {
  hasUnseenFailuresSignal,
  tccStoreSignal,
  widgetExpandedSignal,
} from "@/state";
import { recursivelyInjectDateFields } from "@/utils/time";

export type TCCStore = {
  [traceId: string]: {
    run: UIRun | null;
    steps: UIStep[];
    toolCalls: UIToolCall[];
  };
};

export type NewItems = {
  runs: UIRun[];
  steps: UIStep[];
  toolCalls: UIToolCall[];
};

export type TCCEvent =
  | { type: "initialStore"; data: TCCStore }
  | { type: "newItems"; data: NewItems };

const hasFailure = (items: NewItems) => {
  const { runs, steps, toolCalls } = items;
  const allItems = [runs, steps, toolCalls].flat();
  return allItems.some((item) => item.statusCode === 2);
};

export const useSyncTCCStore = () =>
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:${(window as any).TCC_WSS_PORT}`);

    if (window.TCC_DEBUG) {
      ws.onopen = () => {
        console.log("TCC: WebSocket connected");
      };
    }

    ws.onmessage = (event) => {
      if (window.TCC_DEBUG) {
        console.log("TCC: New ws event received");
      }

      try {
        const eventMessage = JSON.parse(event.data) as TCCEvent;

        // assume eventMessage.data is either TCCStore or NewItems
        const data = recursivelyInjectDateFields(eventMessage.data);

        if (eventMessage.type === "initialStore")
          tccStoreSignal.value = data as TCCStore;
        else if (eventMessage.type === "newItems") {
          tccStoreSignal.value = reconcileStore(
            tccStoreSignal.value,
            data as NewItems
          );
          if (!widgetExpandedSignal.value && hasFailure(data as NewItems))
            hasUnseenFailuresSignal.value = true;
        }
      } catch (error) {
        console.error("TCC: Error parsing event message:", error);
      }
    };
  }, []);
