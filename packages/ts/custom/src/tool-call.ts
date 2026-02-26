import { _debug, _nowIso, _sendPayload } from "./utils";

export type ToolCallConfig = {
  toolCallId?: string;
  startTime?: Date;
  name?: string;
  args?: string | Record<string, unknown>;
  result?: string | Record<string, unknown>;
  endTime?: Date;
  statusCode?: number;
  statusMessage?: string;
};

export class ToolCall {
  private _runId: string;
  private _toolCallId: string;
  private _startTime: string;

  private _toolName: string | null = null;

  private _statusCode: number = 0;
  private _statusMessage: string | null = null;

  private _args: string | null = null;
  private _result: string | null = null;

  private _endTime: string | null = null;
  private _ended = false;

  constructor(
    runId: string,
    toolCallIdOrConfig?: string | ToolCallConfig,
    startTime?: Date
  ) {
    this._runId = runId;

    if (typeof toolCallIdOrConfig === "string") {
      this._toolCallId = toolCallIdOrConfig;
      this._startTime = startTime?.toISOString() ?? _nowIso();
    } else if (toolCallIdOrConfig && typeof toolCallIdOrConfig === "object") {
      const config = toolCallIdOrConfig;
      this._toolCallId = config.toolCallId ?? crypto.randomUUID();
      this._startTime = config.startTime?.toISOString() ?? startTime?.toISOString() ?? _nowIso();
      this.set(config);
    } else {
      this._toolCallId = crypto.randomUUID();
      this._startTime = startTime?.toISOString() ?? _nowIso();
    }

    _debug("ToolCall created");
    _debug("tool_call_id:", this._toolCallId);
    _debug("run_id:", this._runId);
    _debug("start_time:", this._startTime);
  }

  /** Set multiple fields at once. Use instead of chaining .name(), .args(), .result(), etc. */
  set(config: Omit<ToolCallConfig, "toolCallId" | "startTime">): this {
    if (config.name !== undefined) this._toolName = config.name;
    if (config.args !== undefined)
      this._args = typeof config.args === "string" ? config.args : JSON.stringify(config.args);
    if (config.result !== undefined)
      this._result =
        typeof config.result === "string" ? config.result : JSON.stringify(config.result);
    if (config.endTime !== undefined) this._endTime = config.endTime.toISOString();
    if (config.statusCode !== undefined) this._statusCode = config.statusCode;
    if (config.statusMessage !== undefined) this._statusMessage = config.statusMessage;
    _debug("ToolCall set:", config);
    return this;
  }

  name(toolName: string): this {
    this._toolName = toolName;
    _debug("ToolCall name set:", toolName);
    return this;
  }

  args(args: string | Record<string, unknown>): this {
    this._args = typeof args === "string" ? args : JSON.stringify(args);
    _debug(
      "ToolCall args set:",
      this._args.length > 200 ? this._args.slice(0, 200) : this._args
    );
    return this;
  }

  result(result: string | Record<string, unknown>): this {
    this._result = typeof result === "string" ? result : JSON.stringify(result);
    _debug(
      "ToolCall result set:",
      this._result.length > 200 ? this._result.slice(0, 200) : this._result
    );
    return this;
  }

  endTime(date: Date): this {
    this._endTime = date.toISOString();
    _debug("ToolCall endTime set:", this._endTime);
    return this;
  }

  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) {
      this._statusMessage = message;
    }
    _debug("ToolCall status set:", code, message);
    return this;
  }

  error(statusMessage: string = ""): void {
    if (this._ended) {
      throw new Error("[TCC] ToolCall has already ended");
    }

    _debug("ToolCall error:", statusMessage);
    this._statusCode = 2;
    if (statusMessage) {
      this._statusMessage = statusMessage;
    }
    this._ended = true;

    const payload = this._buildPayload();
    _sendPayload(payload, "tool_call").catch(() => {});
  }

  end(): void {
    if (this._ended) {
      throw new Error("[TCC] ToolCall has already ended");
    }

    if (this._toolName === null) {
      throw new Error(
        "[TCC] Cannot end tool call: name is required. Call tc.name(...) before tc.end()"
      );
    }

    this._ended = true;

    const payload = this._buildPayload();
    _sendPayload(payload, "tool_call").catch(() => {});
  }

  private _buildPayload(): Record<string, unknown> {
    const endTime = this._endTime ?? _nowIso();

    const payload: Record<string, unknown> = {
      type: "tool_call",
      run_id: this._runId,
      tool_call_id: this._toolCallId,
      start_time: this._startTime,
      end_time: endTime,
      status_code: this._statusCode,
    };

    if (this._toolName !== null) {
      payload.tool_name = this._toolName;
    }
    if (this._statusMessage !== null) {
      payload.status_message = this._statusMessage;
    }
    if (this._args !== null) {
      payload.args = this._args;
    }
    if (this._result !== null) {
      payload.result = this._result;
    }

    return payload;
  }
}

export function toolCall(
  runId: string,
  toolCallIdOrConfig?: string | ToolCallConfig,
  startTime?: Date
): ToolCall {
  return new ToolCall(runId, toolCallIdOrConfig, startTime);
}
