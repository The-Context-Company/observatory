import { _debug, _nowIso, _sendPayload } from "./utils";

export class ToolCall {
  private _runId: string;
  private _toolCallId: string;
  private _startTime: string;

  private _toolName: string | null = null;

  private _statusCode: number = 0;
  private _statusMessage: string | null = null;

  private _args: string | null = null;
  private _result: string | null = null;

  private _ended = false;

  constructor(runId: string, toolCallId?: string) {
    this._runId = runId;
    this._toolCallId = toolCallId ?? crypto.randomUUID();
    this._startTime = _nowIso();

    _debug("ToolCall created");
    _debug("tool_call_id:", this._toolCallId);
    _debug("run_id:", this._runId);
    _debug("start_time:", this._startTime);
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
    const endTime = _nowIso();

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

export function toolCall(runId: string, toolCallId?: string): ToolCall {
  return new ToolCall(runId, toolCallId);
}
