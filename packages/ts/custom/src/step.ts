import { _SENTINEL, _debug, _nowIso, _sendPayload } from "./utils";
import type { Sentinel } from "./utils";

export class Step {
  private _runId: string;
  private _stepId: string;
  private _startTime: string;

  private _prompt: string | Sentinel = _SENTINEL;
  private _response: string | Sentinel = _SENTINEL;

  private _modelRequested: string | null = null;
  private _modelUsed: string | null = null;
  private _finishReason: string | null = null;

  private _statusCode: number = 0;
  private _statusMessage: string | null = null;

  private _promptUncachedTokens: number | null = null;
  private _promptCachedTokens: number | null = null;
  private _completionTokens: number | null = null;
  private _realTotalCost: number | null = null;

  private _toolDefinitions: string | null = null;

  private _ended = false;

  constructor(runId: string, stepId?: string) {
    this._runId = runId;
    this._stepId = stepId ?? crypto.randomUUID();
    this._startTime = _nowIso();

    _debug("Step created");
    _debug("step_id:", this._stepId);
    _debug("run_id:", this._runId);
    _debug("start_time:", this._startTime);
  }

  prompt(text: string): this {
    this._prompt = text;
    _debug("Step prompt set:", text.length > 200 ? text.slice(0, 200) : text);
    return this;
  }

  response(text: string): this {
    this._response = text;
    _debug(
      "Step response set:",
      text.length > 200 ? text.slice(0, 200) : text
    );
    return this;
  }

  model(params: { requested?: string; used?: string }): this {
    if (params.requested !== undefined) {
      this._modelRequested = params.requested;
      _debug("Step model_requested:", params.requested);
    }
    if (params.used !== undefined) {
      this._modelUsed = params.used;
      _debug("Step model_used:", params.used);
    }
    return this;
  }

  finishReason(reason: string): this {
    this._finishReason = reason;
    _debug("Step finish_reason:", reason);
    return this;
  }

  tokens(params: {
    promptUncached?: number;
    promptCached?: number;
    completion?: number;
  }): this {
    if (params.promptUncached !== undefined) {
      this._promptUncachedTokens = params.promptUncached;
    }
    if (params.promptCached !== undefined) {
      this._promptCachedTokens = params.promptCached;
    }
    if (params.completion !== undefined) {
      this._completionTokens = params.completion;
    }
    _debug("Step tokens:", {
      prompt_uncached: this._promptUncachedTokens,
      prompt_cached: this._promptCachedTokens,
      completion: this._completionTokens,
    });
    return this;
  }

  cost(realTotal: number): this {
    this._realTotalCost = realTotal;
    _debug("Step real_total_cost:", realTotal);
    return this;
  }

  toolDefinitions(definitions: string): this {
    this._toolDefinitions = definitions;
    _debug(
      "Step tool_definitions set:",
      definitions.length > 200 ? definitions.slice(0, 200) : definitions
    );
    return this;
  }

  status(code: number, message?: string): this {
    this._statusCode = code;
    if (message !== undefined) {
      this._statusMessage = message;
    }
    _debug("Step status set:", code, message);
    return this;
  }

  error(statusMessage: string = ""): void {
    if (this._ended) {
      throw new Error("[TCC] Step has already ended");
    }

    _debug("Step error:", statusMessage);
    this._statusCode = 2;
    if (statusMessage) {
      this._statusMessage = statusMessage;
    }
    this._ended = true;

    const payload = this._buildPayload();
    _sendPayload(payload, "step").catch(() => {});
  }

  end(): void {
    if (this._ended) {
      throw new Error("[TCC] Step has already ended");
    }

    if (this._prompt === _SENTINEL) {
      throw new Error(
        "[TCC] Cannot end step: prompt is required. Call s.prompt(...) before s.end()"
      );
    }

    if (this._response === _SENTINEL) {
      throw new Error(
        "[TCC] Cannot end step: response is required. Call s.response(...) before s.end()"
      );
    }

    this._ended = true;

    const payload = this._buildPayload();
    _sendPayload(payload, "step").catch(() => {});
  }

  private _buildPayload(): Record<string, unknown> {
    const endTime = _nowIso();

    const payload: Record<string, unknown> = {
      type: "step",
      run_id: this._runId,
      step_id: this._stepId,
      start_time: this._startTime,
      end_time: endTime,
      status_code: this._statusCode,
    };

    if (this._prompt !== _SENTINEL) {
      payload.prompt = this._prompt;
    }
    if (this._response !== _SENTINEL) {
      payload.response = this._response;
    }
    if (this._modelRequested !== null) {
      payload.model_requested = this._modelRequested;
    }
    if (this._modelUsed !== null) {
      payload.model_used = this._modelUsed;
    }
    if (this._finishReason !== null) {
      payload.finish_reason = this._finishReason;
    }
    if (this._statusMessage !== null) {
      payload.status_message = this._statusMessage;
    }
    if (this._promptUncachedTokens !== null) {
      payload.prompt_uncached_tokens = this._promptUncachedTokens;
    }
    if (this._promptCachedTokens !== null) {
      payload.prompt_cached_tokens = this._promptCachedTokens;
    }
    if (this._completionTokens !== null) {
      payload.completion_tokens = this._completionTokens;
    }
    if (this._realTotalCost !== null) {
      payload.real_total_cost = this._realTotalCost;
    }
    if (this._toolDefinitions !== null) {
      payload.tool_definitions = this._toolDefinitions;
    }

    return payload;
  }
}

export function step(runId: string, stepId?: string): Step {
  return new Step(runId, stepId);
}
