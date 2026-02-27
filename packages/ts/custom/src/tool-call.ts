import type { ToolCallOptions } from "./types";
import { debug } from "./transport";

/** @internal Wire-format payload for a tool call. */
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

/**
 * A tool call represents a single tool/function invocation within a
 * {@link Run}.
 *
 * Tool calls are created via {@link Run.toolCall | run.toolCall()} and
 * are automatically batched with the parent run when it is sent.
 *
 * A tool name must be set (either in the constructor or via
 * {@link ToolCall.name | .name()}) before calling {@link ToolCall.end | .end()}.
 *
 * @example
 * ```ts
 * const tc = r.toolCall("get_weather");
 * tc.args({ city: "San Francisco" });
 * tc.result({ temp: 72, unit: "F" });
 * tc.end();
 * ```
 */
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

  /** Whether this tool call has been finalized via `.end()` or `.error()`. */
  get ended(): boolean {
    return this._ended;
  }

  /**
   * Set the tool name (e.g. `"search"`, `"get_weather"`).
   * Must be set before {@link ToolCall.end | .end()} — either here or via
   * the constructor.
   *
   * @returns `this` for chaining.
   */
  name(toolName: string): this {
    this._name = toolName;
    return this;
  }

  /**
   * Set the arguments passed to the tool. Objects are auto-serialized to JSON.
   *
   * @param value - A JSON string or a plain object.
   * @returns `this` for chaining.
   */
  args(value: string | Record<string, unknown>): this {
    this._args = typeof value === "string" ? value : JSON.stringify(value);
    return this;
  }

  /**
   * Set the return value from the tool. Objects are auto-serialized to JSON.
   *
   * @param value - A JSON string or a plain object.
   * @returns `this` for chaining.
   */
  result(value: string | Record<string, unknown>): this {
    this._result = typeof value === "string" ? value : JSON.stringify(value);
    return this;
  }

  /**
   * Override the tool call's end time. By default, the end time is captured
   * automatically when `.end()` or `.error()` is called.
   *
   * @returns `this` for chaining.
   */
  endTime(date: Date): this {
    this._endTime = date.toISOString();
    return this;
  }

  /**
   * Set the outcome status code and an optional human-readable message.
   *
   * @param code - `0` for success, `2` for error.
   * @param message - Optional status message.
   * @returns `this` for chaining.
   */
  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) this._statusMessage = message;
    return this;
  }

  /**
   * Mark this tool call as errored (status code `2`).
   *
   * @param message - Optional error message.
   * @throws If the tool call has already been ended.
   */
  error(message = ""): void {
    if (this._ended) throw new Error("[TCC] ToolCall already ended");
    this._statusCode = 2;
    if (message) this._statusMessage = message;
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("ToolCall error", { toolCallId: this._toolCallId, message });
  }

  /**
   * Finalize this tool call. A tool name must have been set (via the
   * constructor or {@link ToolCall.name | .name()}) before calling this.
   *
   * @throws If the tool call has already been ended.
   * @throws If no tool name was set.
   */
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
