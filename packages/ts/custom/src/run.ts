import { getConfig } from "./config";
import { Step } from "./step";
import { ToolCall } from "./tool-call";
import { debug, send } from "./transport";
import type { RunOptions, StepOptions, ToolCallOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * A run represents a single end-to-end agent invocation — from user prompt
 * to final response. Use the builder methods to attach data incrementally,
 * then call {@link Run.end | .end()} to finalize and send everything in one
 * batch.
 *
 * Create a run via the {@link run} factory function:
 *
 * @example
 * ```ts
 * import { run } from "@contextcompany/custom";
 *
 * const r = run({ sessionId: "sess_123" });
 * r.prompt("What's the weather?");
 *
 * const s = r.step();
 * s.prompt(JSON.stringify(messages));
 * s.response(assistantContent);
 * s.model("gpt-4o");
 * s.end();
 *
 * r.response("72°F in San Francisco.");
 * await r.end();
 * ```
 */
export class Run {
  private _runId: string;
  private _sessionId: string | null;
  private _conversational: boolean | null;
  private _startTime: string;
  private _endTime: string | null = null;

  private _prompt: { user_prompt: string; system_prompt?: string } | undefined =
    undefined;
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
        (this._timeout as NodeJS.Timeout).unref();
    }

    debug("Run created", { runId: this._runId });
  }

  /** The unique identifier for this run. */
  get runId(): string {
    return this._runId;
  }

  /**
   * Set the user prompt / input that initiated the run.
   * Must be called before {@link Run.end | .end()}.
   *
   * Pass a string for user prompt only, or an object for user + optional
   * system prompt.
   *
   * @example
   * ```ts
   * r.prompt("What's the weather?");
   * r.prompt({ user_prompt: "Summarize this", system_prompt: "You are a helpful assistant." });
   * ```
   *
   * @returns `this` for chaining.
   */
  prompt(
    input: string | { user_prompt: string; system_prompt?: string }
  ): this {
    this._prompt =
      typeof input === "string"
        ? { user_prompt: input }
        : { user_prompt: input.user_prompt, system_prompt: input.system_prompt };
    return this;
  }

  /**
   * Set the agent's final response to the user.
   *
   * @returns `this` for chaining.
   */
  response(text: string): this {
    this._response = text;
    return this;
  }

  /**
   * Attach arbitrary key-value metadata to the run. Multiple calls are
   * merged together. Values must be strings.
   *
   * @example
   * ```ts
   * r.metadata({ agent: "weather-bot", version: "1.2.0" });
   * ```
   *
   * @param entries - One or more `Record<string, string>` objects to merge.
   * @returns `this` for chaining.
   */
  metadata(...entries: Record<string, string>[]): this {
    if (!this._metadata) this._metadata = {};
    for (const entry of entries) {
      Object.assign(this._metadata, entry);
    }
    return this;
  }

  /**
   * Set the outcome status code and an optional human-readable message.
   *
   * @param code - `0` for success, `2` for error.
   * @param message - Optional status message (e.g. an error description).
   * @returns `this` for chaining.
   */
  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) this._statusMessage = message;
    return this;
  }

  /**
   * Override the run's end time. By default, the end time is captured
   * automatically when {@link Run.end | .end()} or {@link Run.error | .error()}
   * is called.
   *
   * @returns `this` for chaining.
   */
  endTime(date: Date): this {
    this._endTime = date.toISOString();
    return this;
  }

  /**
   * Create a new {@link Step} attached to this run. The step is batched
   * and sent together with the run when {@link Run.end | .end()} is called.
   *
   * @param stepIdOrOptions - A custom step ID string, or a {@link StepOptions}
   *   object. Omit to auto-generate an ID.
   *
   * @example
   * ```ts
   * const s = r.step();
   * s.prompt(messages).response(content).model("gpt-4o").end();
   * ```
   */
  step(stepIdOrOptions?: string | StepOptions): Step {
    const opts: StepOptions | undefined =
      typeof stepIdOrOptions === "string"
        ? { stepId: stepIdOrOptions }
        : stepIdOrOptions;
    const s = new Step(this._runId, opts);
    this._steps.push(s);
    return s;
  }

  /**
   * Create a new {@link ToolCall} attached to this run. The tool call is
   * batched and sent together with the run when {@link Run.end | .end()} is
   * called.
   *
   * @param nameOrOptions - A tool name string, or a {@link ToolCallOptions}
   *   object. Omit to set the name later via {@link ToolCall.name | .name()}.
   *
   * @example
   * ```ts
   * const tc = r.toolCall("get_weather");
   * tc.args({ city: "SF" }).result({ temp: 72 }).end();
   * ```
   */
  toolCall(nameOrOptions?: string | ToolCallOptions): ToolCall {
    const tc = new ToolCall(this._runId, nameOrOptions);
    this._toolCalls.push(tc);
    return tc;
  }

  /**
   * End the run with error status (`2`) and send the payload.
   * Any un-ended child steps and tool calls are automatically marked as
   * errored as well.
   *
   * @param message - Optional error message.
   * @throws If the run has already been ended.
   */
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

  /**
   * Finalize the run and send the payload (including all attached steps
   * and tool calls) in a single batch request.
   *
   * @throws If the run has already been ended.
   * @throws If {@link Run.prompt | .prompt()} was not called.
   * @throws If any attached steps or tool calls have not been ended.
   */
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

/**
 * Create a new {@link Run} builder. This is the main entry point for the
 * builder pattern — instrument your agent as it executes, then call
 * `.end()` to send everything in one batch.
 *
 * @example
 * ```ts
 * import { run } from "@contextcompany/custom";
 *
 * const r = run({ sessionId: "sess_123", conversational: true });
 * r.prompt("What's the weather in SF?");
 * r.response("72°F and sunny.");
 * await r.end();
 * ```
 *
 * @param options - Optional run configuration. See {@link RunOptions}.
 */
export function run(options?: RunOptions): Run {
  return new Run(options);
}
