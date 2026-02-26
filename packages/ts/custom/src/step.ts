import type { StepOptions, TokenUsage, ModelConfig } from "./types";
import { debug } from "./transport";

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

  get ended(): boolean {
    return this._ended;
  }

  prompt(text: string): this {
    this._prompt = text;
    return this;
  }

  response(text: string): this {
    this._response = text;
    return this;
  }

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

  finishReason(reason: string): this {
    this._finishReason = reason;
    return this;
  }

  tokens(usage: TokenUsage): this {
    Object.assign(this._tokens, usage);
    return this;
  }

  cost(amount: number): this {
    this._cost = amount;
    return this;
  }

  toolDefinitions(defs: string | unknown[]): this {
    this._toolDefinitions =
      typeof defs === "string" ? defs : JSON.stringify(defs);
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

  error(message = ""): void {
    if (this._ended) throw new Error("[TCC] Step already ended");
    this._statusCode = 2;
    if (message) this._statusMessage = message;
    this._ended = true;
    this._endTime ??= new Date().toISOString();
    debug("Step error", { stepId: this._stepId, message });
  }

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
