import { Step } from "./step";
import { ToolCall } from "./tool-call";
import { _SENTINEL, _debug, _nowIso, _sendPayload } from "./utils";
import type { Sentinel } from "./utils";

export class Run {
  private _runId: string;
  private _sessionId: string | null;
  private _conversational: boolean | null;
  private _startTime: string;

  private _prompt: string | Sentinel = _SENTINEL;
  private _response: string | null = null;

  private _statusCode: number = 0;
  private _statusMessage: string | null = null;

  private _metadata: Record<string, string> | null = null;

  private _ended = false;

  constructor(params?: {
    runId?: string;
    sessionId?: string;
    conversational?: boolean;
  }) {
    this._runId = params?.runId ?? crypto.randomUUID();
    this._sessionId = params?.sessionId ?? null;
    this._conversational = params?.conversational ?? null;
    this._startTime = _nowIso();

    _debug("Run created");
    _debug("run_id:", this._runId);
    _debug("session_id:", this._sessionId);
    _debug("conversational:", this._conversational);
    _debug("start_time:", this._startTime);
  }

  get runId(): string {
    return this._runId;
  }

  step(stepId?: string): Step {
    return new Step(this._runId, stepId);
  }

  toolCall(toolCallId?: string): ToolCall {
    return new ToolCall(this._runId, toolCallId);
  }

  prompt(text: string): this {
    this._prompt = text;
    _debug("Run prompt set:", text.length > 200 ? text.slice(0, 200) : text);
    return this;
  }

  response(text: string): this {
    this._response = text;
    _debug(
      "Run response set:",
      text.length > 200 ? text.slice(0, 200) : text
    );
    return this;
  }

  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) {
      this._statusMessage = message;
    }
    _debug("Run status set:", code, message);
    return this;
  }

  metadata(json?: Record<string, string>, ...entries: Record<string, string>[]): this {
    if (this._metadata === null) {
      this._metadata = {};
    }
    if (json !== undefined) {
      Object.assign(this._metadata, json);
    }
    for (const entry of entries) {
      Object.assign(this._metadata, entry);
    }
    _debug("Run metadata:", this._metadata);
    return this;
  }

  error(statusMessage: string = ""): void {
    if (this._ended) {
      throw new Error("[TCC] Run has already ended");
    }

    _debug("Run error:", statusMessage);
    this._statusCode = 2;
    if (statusMessage) {
      this._statusMessage = statusMessage;
    }
    this._ended = true;

    const payload = this._buildPayload();
    _sendPayload(payload, "run").catch(() => {});
  }

  end(): void {
    if (this._ended) {
      throw new Error("[TCC] Run has already ended");
    }

    if (this._prompt === _SENTINEL) {
      throw new Error(
        "[TCC] Cannot end run: prompt is required. Call r.prompt(...) before r.end()"
      );
    }

    this._ended = true;

    const payload = this._buildPayload();
    _sendPayload(payload, "run").catch(() => {});
  }

  private _buildPayload(): Record<string, unknown> {
    const endTime = _nowIso();

    const payload: Record<string, unknown> = {
      type: "run",
      run_id: this._runId,
      start_time: this._startTime,
      end_time: endTime,
      status_code: this._statusCode,
    };

    if (this._prompt !== _SENTINEL) {
      payload.prompt = this._prompt;
    }
    if (this._sessionId !== null) {
      payload.session_id = this._sessionId;
    }
    if (this._conversational !== null) {
      payload.conversational = this._conversational;
    }
    if (this._response !== null) {
      payload.response = this._response;
    }
    if (this._statusMessage !== null) {
      payload.status_message = this._statusMessage;
    }
    if (this._metadata !== null) {
      payload.metadata = this._metadata;
    }

    return payload;
  }
}

export function run(params?: {
  runId?: string;
  sessionId?: string;
  conversational?: boolean;
}): Run {
  return new Run(params);
}
