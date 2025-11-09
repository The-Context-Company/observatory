import {
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { type ExportResult, ExportResultCode } from "@opentelemetry/core";
import { EventEmitter } from "events";
import { shapeSpansIntoRuns } from "./utils/converters";
import { type UIRun, type UIStep, type UIToolCall } from "./types";
import { captureAnonymousEvent, shutdownPosthog } from "../telemetry/posthog";

type LocalCallback = (newItems: {
  runs: UIRun[];
  steps: UIStep[];
  toolCalls: UIToolCall[];
}) => void;

type DataStore = {
  [traceId: string]: {
    run: UIRun | null;
    steps: UIStep[];
    toolCalls: UIToolCall[];
  };
};

export class LocalSpanExporter extends EventEmitter implements SpanExporter {
  constructor() {
    super();
  }

  private _dataStore: DataStore = {};

  protected _stopped = false;
  private _subscribers = new Set<LocalCallback>();

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (this._stopped)
      return resultCallback({
        code: ExportResultCode.FAILED,
        error: new Error("Exporter has been stopped"),
      });

    const { runs, steps, toolCalls } = shapeSpansIntoRuns(spans);

    this._upsertItemsToStore({ runs, steps, toolCalls });

    this._subscribers.forEach((callback) =>
      callback({ runs, steps, toolCalls })
    );

    runs.forEach((run) => {
      captureAnonymousEvent({
        event: "agent_run_end",
        status_code: run.statusCode,
        duration_ns: run.durationNs,
      });
    });

    steps.forEach((step) => {
      captureAnonymousEvent({
        event: "step_end",
        status_code: step.statusCode,
        duration_ns: step.durationNs,
      });
    });

    toolCalls.forEach((toolCall) => {
      captureAnonymousEvent({
        event: "tool_call_end",
        status_code: toolCall.statusCode,
        duration_ns: toolCall.durationNs,
      });
    });

    setTimeout(() => resultCallback({ code: ExportResultCode.SUCCESS }), 0);
  }

  shutdown(): Promise<void> {
    this._stopped = true;
    this._dataStore = {};
    return shutdownPosthog().then(() => this.forceFlush());
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  reset(): void {
    this._dataStore = {};
  }

  getDataStore(): DataStore {
    return this._dataStore;
  }

  subscribe(callback: LocalCallback): () => void {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  private _upsertItemsToStore(items: {
    runs: UIRun[];
    steps: UIStep[];
    toolCalls: UIToolCall[];
  }): void {
    const { runs, steps, toolCalls } = items;
    runs.forEach((run) => {
      if (this._dataStore[run.traceId]) {
        this._dataStore[run.traceId].run = run;
      } else {
        this._dataStore[run.traceId] = {
          run: run,
          steps: [],
          toolCalls: [],
        };
      }
    });

    steps.forEach((step) => {
      if (this._dataStore[step.traceId]) {
        this._dataStore[step.traceId].steps.push(step);
      } else {
        this._dataStore[step.traceId] = {
          run: null,
          steps: [step],
          toolCalls: [],
        };
      }
    });

    toolCalls.forEach((toolCall) => {
      if (this._dataStore[toolCall.traceId]) {
        this._dataStore[toolCall.traceId].toolCalls.push(toolCall);
      } else {
        this._dataStore[toolCall.traceId] = {
          run: null,
          steps: [],
          toolCalls: [toolCall],
        };
      }
    });
  }
}
