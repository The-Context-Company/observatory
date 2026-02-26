import { getConfig } from "./config";
import { Step } from "./step";
import { ToolCall } from "./tool-call";
import { debug, send } from "./transport";
import type { RunOptions, StepOptions, ToolCallOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export class Run {
  private _runId: string;
  private _sessionId: string | null;
  private _conversational: boolean | null;
  private _startTime: string;
  private _endTime: string | null = null;

  private _prompt: string | undefined = undefined;
  private _response: string | null = null;

  private _statusCode = 0;
  private _statusMessage: string | null = null;

  private _metadata: Record<string, string> | null = null;

  private _steps: Step[] = [];
  private _toolCalls: ToolCall[] = [];

  private _ended = false;
  private _timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: RunOptions) {
    this._runId = options?.runId ?? crypto.randomUUID();
    this._sessionId = options?.sessionId ?? null;
    this._conversational = options?.conversational ?? null;
    this._startTime = (options?.startTime ?? new Date()).toISOString();

    const timeoutMs =
      options?.timeout ?? getConfig().runTimeout ?? DEFAULT_TIMEOUT_MS;

    if (timeoutMs > 0) {
      this._timeout = setTimeout(() => {
        if (this._ended) return;
        this.error("Run timed out — auto-flushed").catch(() => {});
      }, timeoutMs);

      if (typeof this._timeout === "object" && "unref" in this._timeout)
        (this._timeout as NodeJS.Timeout).unref(); // avoid keeping Node process alive
    }

    debug("Run created", { runId: this._runId });
  }

  get runId(): string {
    return this._runId;
  }

  prompt(text: string): this {
    this._prompt = text;
    return this;
  }

  response(text: string): this {
    this._response = text;
    return this;
  }

  metadata(...entries: Record<string, string>[]): this {
    if (!this._metadata) this._metadata = {};
    for (const entry of entries) {
      Object.assign(this._metadata, entry);
    }
    return this;
  }

  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) this._statusMessage = message;
    return this;
  }

  endTime(date: Date): this {
    this._endTime = date.toISOString();
    return this;
  }

  step(stepIdOrOptions?: string | StepOptions): Step {
    const opts: StepOptions | undefined =
      typeof stepIdOrOptions === "string"
        ? { stepId: stepIdOrOptions }
        : stepIdOrOptions;
    const s = new Step(this._runId, opts);
    this._steps.push(s);
    return s;
  }

  toolCall(nameOrOptions?: string | ToolCallOptions): ToolCall {
    const tc = new ToolCall(this._runId, nameOrOptions);
    this._toolCalls.push(tc);
    return tc;
  }

  async error(message = ""): Promise<void> {
    if (this._ended) throw new Error("[TCC] Run already ended");
    this._clearTimeout();
    this._statusCode = 2;
    if (message) this._statusMessage = message;
    this._ended = true;
    this._endTime ??= new Date().toISOString();

    for (const s of this._steps) {
      if (!s.ended) s.error("Parent run errored");
    }
    for (const tc of this._toolCalls) {
      if (!tc.ended) tc.error("Parent run errored");
    }

    debug("Run error", { runId: this._runId, message });
    await this._send();
  }

  async end(): Promise<void> {
    if (this._ended) throw new Error("[TCC] Run already ended");

    if (this._prompt === undefined) {
      throw new Error(
        "[TCC] Run requires a prompt. Call .prompt() before .end()"
      );
    }

    const unendedSteps = this._steps.filter((s) => !s.ended);
    if (unendedSteps.length > 0) {
      throw new Error(
        `[TCC] ${unendedSteps.length} step(s) not ended. Call .end() on all steps before ending the run.`
      );
    }

    const unendedToolCalls = this._toolCalls.filter((tc) => !tc.ended);
    if (unendedToolCalls.length > 0) {
      throw new Error(
        `[TCC] ${unendedToolCalls.length} tool call(s) not ended. Call .end() on all tool calls before ending the run.`
      );
    }

    this._clearTimeout();
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("Run ended", { runId: this._runId });
    await this._send();
  }

  private _clearTimeout(): void {
    if (this._timeout !== null) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  }

  private async _send(): Promise<void> {
    const runPayload = this._buildPayload();
    const stepPayloads = this._steps.map((s) => s._toPayload());
    const toolCallPayloads = this._toolCalls.map((tc) => tc._toPayload());

    const items = [runPayload, ...stepPayloads, ...toolCallPayloads];

    if (items.length === 1) {
      await send(runPayload);
    } else {
      await send({ type: "batch", items });
    }
  }

  private _buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      type: "run",
      run_id: this._runId,
      start_time: this._startTime,
      end_time: this._endTime ?? new Date().toISOString(),
      status_code: this._statusCode,
    };

    if (this._prompt !== undefined) payload.prompt = this._prompt;
    if (this._sessionId !== null) payload.session_id = this._sessionId;
    if (this._conversational !== null)
      payload.conversational = this._conversational;
    if (this._response !== null) payload.response = this._response;
    if (this._statusMessage !== null)
      payload.status_message = this._statusMessage;
    if (this._metadata !== null) payload.metadata = this._metadata;

    return payload;
  }
}

export function run(options?: RunOptions): Run {
  return new Run(options);
}
