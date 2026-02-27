import type { StepOptions, TokenUsage, ModelConfig } from "./types";
import { debug } from "./transport";

/** @internal Wire-format payload for a step. */
export type StepPayload = {
  type: "step";
  run_id: string;
  step_id: string;
  start_time: string;
  end_time: string;
  prompt: string;
  response: string;
  status_code: number;
  status_message?: string;
  model_requested?: string;
  model_used?: string;
  finish_reason?: string;
  prompt_uncached_tokens?: number;
  prompt_cached_tokens?: number;
  completion_tokens?: number;
  real_total_cost?: number;
  tool_definitions?: string;
};

/**
 * A step represents a single LLM invocation within a {@link Run}.
 *
 * Steps are created via {@link Run.step | run.step()} and are automatically
 * batched with the parent run when it is sent.
 *
 * Both {@link Step.prompt | .prompt()} and {@link Step.response | .response()}
 * must be called before {@link Step.end | .end()}.
 *
 * @example
 * ```ts
 * const s = r.step();
 * s.prompt(JSON.stringify(messages));
 * s.response(assistantContent);
 * s.model("gpt-4o");
 * s.tokens({ uncached: 120, cached: 30, completion: 45 });
 * s.cost(0.0042);
 * s.end();
 * ```
 */
export class Step {
  private _runId: string;
  private _stepId: string;
  private _startTime: string;
  private _endTime: string | null = null;

  private _prompt: string | undefined = undefined;
  private _response: string | undefined = undefined;

  private _modelRequested: string | null = null;
  private _modelUsed: string | null = null;
  private _finishReason: string | null = null;

  private _statusCode = 0;
  private _statusMessage: string | null = null;

  private _tokens: TokenUsage = {};
  private _cost: number | null = null;
  private _toolDefinitions: string | null = null;

  private _ended = false;

  constructor(runId: string, options?: StepOptions) {
    this._runId = runId;
    this._stepId = options?.stepId ?? crypto.randomUUID();
    this._startTime = (options?.startTime ?? new Date()).toISOString();
    debug("Step created", { stepId: this._stepId, runId });
  }

  /** Whether this step has been finalized via `.end()` or `.error()`. */
  get ended(): boolean {
    return this._ended;
  }

  /**
   * Set the prompt sent to the LLM.
   * Must be called before {@link Step.end | .end()}.
   *
   * @returns `this` for chaining.
   */
  prompt(text: string): this {
    this._prompt = text;
    return this;
  }

  /**
   * Set the LLM's response text.
   * Must be called before {@link Step.end | .end()}.
   *
   * @returns `this` for chaining.
   */
  response(text: string): this {
    this._response = text;
    return this;
  }

  /**
   * Set the model used for this step.
   *
   * Pass a string when the requested and used model are the same, or an
   * object to distinguish between them.
   *
   * @example
   * ```ts
   * s.model("gpt-4o");
   * s.model({ requested: "gpt-4o", used: "gpt-4o-2024-08-06" });
   * ```
   *
   * @returns `this` for chaining.
   */
  model(config: ModelConfig): this {
    if (typeof config === "string") {
      this._modelRequested = config;
      this._modelUsed = config;
      return this;
    }
    if (config.requested !== undefined) this._modelRequested = config.requested;
    if (config.used !== undefined) this._modelUsed = config.used;
    return this;
  }

  /**
   * Set the model's finish / stop reason (e.g. `"stop"`, `"length"`,
   * `"tool_calls"`).
   *
   * @returns `this` for chaining.
   */
  finishReason(reason: string): this {
    this._finishReason = reason;
    return this;
  }

  /**
   * Record token usage for this step. Multiple calls are merged.
   *
   * @example
   * ```ts
   * s.tokens({ uncached: 120, cached: 30, completion: 45 });
   * ```
   *
   * @param usage - Token counts. See {@link TokenUsage}.
   * @returns `this` for chaining.
   */
  tokens(usage: TokenUsage): this {
    Object.assign(this._tokens, usage);
    return this;
  }

  /**
   * Set the actual cost of this step in USD.
   *
   * @returns `this` for chaining.
   */
  cost(amount: number): this {
    this._cost = amount;
    return this;
  }

  /**
   * Set the tool definitions / function schemas that were available to
   * the model during this step. Arrays are auto-serialized to JSON.
   *
   * @param defs - A JSON string or an array of tool definition objects.
   * @returns `this` for chaining.
   */
  toolDefinitions(defs: string | unknown[]): this {
    this._toolDefinitions =
      typeof defs === "string" ? defs : JSON.stringify(defs);
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
   * Override the step's end time. By default, the end time is captured
   * automatically when `.end()` or `.error()` is called.
   *
   * @returns `this` for chaining.
   */
  endTime(date: Date): this {
    this._endTime = date.toISOString();
    return this;
  }

  /**
   * Mark this step as errored (status code `2`).
   *
   * @param message - Optional error message.
   * @throws If the step has already been ended.
   */
  error(message = ""): void {
    if (this._ended) throw new Error("[TCC] Step already ended");
    this._statusCode = 2;
    if (message) this._statusMessage = message;
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("Step error", { stepId: this._stepId, message });
  }

  /**
   * Finalize this step. Both `.prompt()` and `.response()` must have been
   * called before this.
   *
   * @throws If the step has already been ended.
   * @throws If `.prompt()` or `.response()` was not called.
   */
  end(): void {
    if (this._ended) throw new Error("[TCC] Step already ended");
    if (this._prompt === undefined) {
      throw new Error(
        "[TCC] Step requires a prompt. Call .prompt() before .end()"
      );
    }
    if (this._response === undefined) {
      throw new Error(
        "[TCC] Step requires a response. Call .response() before .end()"
      );
    }
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("Step ended", { stepId: this._stepId });
  }

  /** @internal */
  _toPayload(): StepPayload {
    const payload: StepPayload = {
      type: "step",
      run_id: this._runId,
      step_id: this._stepId,
      start_time: this._startTime,
      end_time: this._endTime ?? new Date().toISOString(),
      prompt: this._prompt ?? "",
      response: this._response ?? "",
      status_code: this._statusCode,
    };

    if (this._statusMessage !== null) payload.status_message = this._statusMessage;
    if (this._modelRequested !== null) payload.model_requested = this._modelRequested;
    if (this._modelUsed !== null) payload.model_used = this._modelUsed;
    if (this._finishReason !== null) payload.finish_reason = this._finishReason;
    if (this._tokens.uncached !== undefined)
      payload.prompt_uncached_tokens = this._tokens.uncached;
    if (this._tokens.cached !== undefined)
      payload.prompt_cached_tokens = this._tokens.cached;
    if (this._tokens.completion !== undefined)
      payload.completion_tokens = this._tokens.completion;
    if (this._cost !== null) payload.real_total_cost = this._cost;
    if (this._toolDefinitions !== null)
      payload.tool_definitions = this._toolDefinitions;

    return payload;
  }
}
