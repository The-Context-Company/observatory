import type { ToolCallOptions } from "./types";
import { debug } from "./transport";

export type ToolCallPayload = {
  type: "tool_call";
  run_id: string;
  tool_call_id: string;
  tool_name: string;
  start_time: string;
  end_time: string;
  status_code: number;
  status_message?: string;
  args?: string;
  result?: string;
};

export class ToolCall {
  private _runId: string;
  private _toolCallId: string;
  private _startTime: string;
  private _endTime: string | null = null;

  private _name: string | null = null;

  private _statusCode = 0;
  private _statusMessage: string | null = null;

  private _args: string | null = null;
  private _result: string | null = null;

  private _ended = false;

  constructor(runId: string, nameOrOptions?: string | ToolCallOptions) {
    this._runId = runId;

    if (typeof nameOrOptions === "string") {
      this._name = nameOrOptions;
      this._toolCallId = crypto.randomUUID();
      this._startTime = new Date().toISOString();
    } else {
      this._toolCallId = nameOrOptions?.toolCallId ?? crypto.randomUUID();
      this._startTime = (nameOrOptions?.startTime ?? new Date()).toISOString();
      if (nameOrOptions?.name) this._name = nameOrOptions.name;
    }

    debug("ToolCall created", { toolCallId: this._toolCallId, runId });
  }

  get ended(): boolean {
    return this._ended;
  }

  name(toolName: string): this {
    this._name = toolName;
    return this;
  }

  args(value: string | Record<string, unknown>): this {
    this._args = typeof value === "string" ? value : JSON.stringify(value);
    return this;
  }

  result(value: string | Record<string, unknown>): this {
    this._result = typeof value === "string" ? value : JSON.stringify(value);
    return this;
  }

  endTime(date: Date): this {
    this._endTime = date.toISOString();
    return this;
  }

  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) this._statusMessage = message;
    return this;
  }

  error(message = ""): void {
    if (this._ended) throw new Error("[TCC] ToolCall already ended");
    this._statusCode = 2;
    if (message) this._statusMessage = message;
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("ToolCall error", { toolCallId: this._toolCallId, message });
  }

  end(): void {
    if (this._ended) throw new Error("[TCC] ToolCall already ended");
    if (this._name === null) {
      throw new Error(
        "[TCC] ToolCall requires a name. Call .name() or pass it to run.toolCall('name') before .end()"
      );
    }
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("ToolCall ended", { toolCallId: this._toolCallId });
  }

  /** @internal */
  _toPayload(): ToolCallPayload {
    const payload: ToolCallPayload = {
      type: "tool_call",
      run_id: this._runId,
      tool_call_id: this._toolCallId,
      tool_name: this._name ?? "unknown",
      start_time: this._startTime,
      end_time: this._endTime ?? new Date().toISOString(),
      status_code: this._statusCode,
    };

    if (this._statusMessage !== null)
      payload.status_message = this._statusMessage;
    if (this._args !== null) payload.args = this._args;
    if (this._result !== null) payload.result = this._result;

    return payload;
  }
}
