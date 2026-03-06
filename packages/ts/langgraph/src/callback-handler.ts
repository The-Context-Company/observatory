import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import {
  BaseCallbackHandler,
  type BaseCallbackHandlerInput,
} from "@langchain/core/callbacks/base";
import type { DocumentInterface } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  ChatGeneration,
  ChatResult,
  Generation,
  LLMResult,
} from "@langchain/core/outputs";
import type { ChainValues } from "@langchain/core/utils/types";
import type {
  BatchPayload,
  RunPayload,
  StepPayload,
  TCCCallbackHandlerConfig,
  ToolCallPayload,
} from "./types";

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

type SpanRecord = {
  name: string;
  kind: "chain" | "llm" | "tool" | "retriever" | "agent";
  startTime: Date;
  endTime?: Date;
  parentRunId?: string;
  input?: unknown;
  output?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
  tags?: string[];
  serialized?: Serialized;
  extraParams?: Record<string, unknown>;
  model?: string;
  modelUsed?: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  ttftMs?: number;
};

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getMessageContent(msg: unknown): string {
  if (!msg || typeof msg !== "object") return safeStringify(msg);
  const m = msg as Record<string, unknown>;
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((block: unknown) => {
        if (typeof block === "string") return block;
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") return b.text;
        return safeStringify(block);
      })
      .join("");
  }
  return safeStringify(m.content);
}

function getMessageRole(msg: unknown): string {
  if (!msg || typeof msg !== "object") return "unknown";
  const m = msg as { _getType?: () => string; role?: string };
  try {
    if (typeof m._getType === "function") return m._getType();
  } catch {
    /* ignore */
  }
  if (typeof m.role === "string") return m.role;
  return "unknown";
}

/**
 * Extract prompt text from LLM input.
 * - handleLLMStart passes `string[]`
 * - handleChatModelStart passes `BaseMessage[][]`
 */
function extractLLMPrompt(input: unknown): string {
  if (!Array.isArray(input) || input.length === 0) return safeStringify(input);

  // string[] from handleLLMStart
  if (typeof input[0] === "string") return input.join("\n");

  // BaseMessage[][] from handleChatModelStart
  if (Array.isArray(input[0])) {
    const messages = input[0] as unknown[];
    return messages
      .map((msg) => {
        const role = getMessageRole(msg);
        const content = getMessageContent(msg);
        return `${role}: ${content}`;
      })
      .join("\n");
  }

  return safeStringify(input);
}

/**
 * Extract response text from LLM output (LLMResult | ChatResult).
 * Returns the generated text content, or a summary of tool calls if the
 * response has no text content (tool_calls finish reason).
 */
function extractLLMResponse(output: unknown): string {
  if (!output || typeof output !== "object") return safeStringify(output);

  const result = output as LLMResult | ChatResult;
  for (const gen of walkGenerations(result)) {
    if ("message" in gen && gen.message) {
      const msg = gen.message as unknown as Record<string, unknown>;
      const content = getMessageContent(msg);
      if (content.length > 0) return content;

      const toolCalls = msg.tool_calls as
        | Array<{ name: string; args: unknown }>
        | undefined;
      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        return JSON.stringify(
          toolCalls.map((tc) => ({ name: tc.name, args: tc.args }))
        );
      }
    }
    if (gen.text) return gen.text;
  }

  return safeStringify(output);
}

/**
 * Extract user prompt from a chain/graph input (for the top-level Run).
 */
function extractRunUserPrompt(input: unknown): string {
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return safeStringify(input);

  const obj = input as Record<string, unknown>;

  if (Array.isArray(obj.messages)) {
    for (let i = obj.messages.length - 1; i >= 0; i--) {
      const msg = obj.messages[i] as unknown;
      const role = getMessageRole(msg);
      if (role === "human" || role === "user") {
        return getMessageContent(msg);
      }
    }
  }

  if (typeof obj.input === "string") return obj.input;
  if (typeof obj.question === "string") return obj.question;
  if (typeof obj.query === "string") return obj.query;

  return safeStringify(input);
}

/**
 * Extract final response from a chain/graph output (for the top-level Run).
 */
function extractRunResponse(output: unknown): string {
  if (typeof output === "string") return output;
  if (!output || typeof output !== "object") return safeStringify(output);

  const obj = output as Record<string, unknown>;

  if (typeof obj.output === "string") return obj.output;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.content === "string") return obj.content;
  if (typeof obj.answer === "string") return obj.answer;
  if (typeof obj.result === "string") return obj.result;

  if (Array.isArray(obj.messages)) {
    for (let i = obj.messages.length - 1; i >= 0; i--) {
      const msg = obj.messages[i] as unknown;
      const role = getMessageRole(msg);
      if (role === "ai" || role === "assistant") {
        return getMessageContent(msg);
      }
    }
  }

  return safeStringify(output);
}

/**
 * Extract clean text from a tool result (may be a ToolMessage or plain value).
 */
/**
 * Recursively flatten a nested object into dot-separated keys.
 * Skips undefined/null values and caps depth to avoid blowing up on circular refs.
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  maxDepth = 4,
  depth = 0
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (depth >= maxDepth) return result;

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === "function") continue;

    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(
        result,
        flattenObject(
          value as Record<string, unknown>,
          fullKey,
          maxDepth,
          depth + 1
        )
      );
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

/**
 * Extract all raw metadata from an LLM output (LLMResult | ChatResult)
 * into a flat attributes object — response_metadata, usage_metadata, llmOutput, etc.
 */
function extractLLMOutputAttributes(output: unknown): Record<string, unknown> {
  if (!output || typeof output !== "object") return {};

  const attrs: Record<string, unknown> = {};
  const result = output as LLMResult | ChatResult;

  for (const gen of walkGenerations(result)) {
    if ("message" in gen && gen.message) {
      const msg = gen.message as unknown as Record<string, unknown>;
      if (msg.response_metadata && typeof msg.response_metadata === "object") {
        Object.assign(
          attrs,
          flattenObject(
            msg.response_metadata as Record<string, unknown>,
            "llm.response_metadata"
          )
        );
      }
      if (msg.usage_metadata && typeof msg.usage_metadata === "object") {
        Object.assign(
          attrs,
          flattenObject(
            msg.usage_metadata as Record<string, unknown>,
            "llm.usage_metadata"
          )
        );
      }
      if (msg.id) attrs["llm.response_id"] = msg.id;
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        attrs["llm.tool_calls"] = JSON.stringify(msg.tool_calls);
        attrs["llm.tool_call_count"] = msg.tool_calls.length;
      }
      break;
    }
  }

  const llmOutput = (result as LLMResult).llmOutput;
  if (llmOutput && typeof llmOutput === "object") {
    Object.assign(
      attrs,
      flattenObject(llmOutput as Record<string, unknown>, "llm.output")
    );
  }

  return attrs;
}

function extractToolResult(output: unknown): string {
  if (typeof output === "string") return output;
  if (!output || typeof output !== "object") return safeStringify(output);
  const msg = output as Record<string, unknown>;
  if (typeof msg.content === "string") return msg.content;
  return safeStringify(output);
}

function walkGenerations(
  response: LLMResult | ChatResult
): (Generation | ChatGeneration)[] {
  const result: (Generation | ChatGeneration)[] = [];
  const generations =
    (response as LLMResult).generations || (response as ChatResult).generations;
  if (!generations) return result;
  for (const batch of generations) {
    if (Array.isArray(batch)) {
      for (const gen of batch) result.push(gen);
    } else {
      result.push(batch);
    }
  }
  return result;
}

function getModelFromResponse(
  response: LLMResult | ChatResult
): string | undefined {
  for (const gen of walkGenerations(response)) {
    if ("message" in gen && gen.message) {
      const msg = gen.message as unknown as Record<string, unknown>;
      const meta = msg.response_metadata as Record<string, unknown> | undefined;
      if (meta) {
        const model =
          (meta.model_name as string) || (meta.model as string) || undefined;
        if (model) return model;
      }
    }
  }
  const llmOutput = (response as LLMResult).llmOutput;
  if (llmOutput) {
    return (
      (llmOutput.model_name as string) ||
      (llmOutput.model as string) ||
      undefined
    );
  }
  return undefined;
}

function getFinishReasonFromResponse(
  response: LLMResult | ChatResult
): string | undefined {
  for (const gen of walkGenerations(response)) {
    if ("message" in gen && gen.message) {
      const msg = gen.message as unknown as Record<string, unknown>;
      const meta = msg.response_metadata as Record<string, unknown> | undefined;
      if (meta?.finish_reason) return meta.finish_reason as string;
    }
    const info = gen.generationInfo as Record<string, unknown> | undefined;
    if (info?.finish_reason) return info.finish_reason as string;
  }
  return undefined;
}

function getTokensFromResponse(response: LLMResult | ChatResult): {
  prompt: number;
  completion: number;
  cached: number;
} {
  for (const gen of walkGenerations(response)) {
    if ("message" in gen && gen.message) {
      const msg = gen.message as unknown as Record<string, unknown>;
      const usage = msg.usage_metadata as Record<string, unknown> | undefined;
      if (usage) {
        const details = usage.input_token_details as
          | Record<string, unknown>
          | undefined;
        return {
          prompt: (usage.input_tokens as number) || 0,
          completion: (usage.output_tokens as number) || 0,
          cached: (details?.cache_read as number) || 0,
        };
      }
    }
  }

  const llmOutput = (response as LLMResult).llmOutput;
  if (llmOutput) {
    const tokenUsage =
      (llmOutput.tokenUsage as Record<string, unknown>) ||
      (llmOutput.estimatedTokens as Record<string, unknown>) ||
      {};
    return {
      prompt: (tokenUsage.promptTokens as number) || 0,
      completion: (tokenUsage.completionTokens as number) || 0,
      cached: 0,
    };
  }

  return { prompt: 0, completion: 0, cached: 0 };
}

type InvocationState = {
  tccRunId: string;
  spans: Map<string, SpanRecord>;
  startTimes: Map<string, number>;
  firstTokenTimes: Map<string, number>;
  skippedRuns: Set<string>;
};

export class TCCCallbackHandler
  extends BaseCallbackHandler
  implements BaseCallbackHandlerInput
{
  name = "TCCCallbackHandler";

  private apiKey: string;
  private endpoint: string;
  private fixedRunId?: string;
  private sessionId?: string;
  private conversational: boolean;
  private customMetadata: Record<string, unknown>;
  private debugEnabled: boolean;

  private invocations = new Map<string, InvocationState>();
  private spanToRoot = new Map<string, string>();

  constructor(config: TCCCallbackHandlerConfig = {}) {
    super();

    const apiKey = config.apiKey || getTCCApiKey();
    if (!apiKey) {
      throw new Error(
        "Missing API key: set TCC_API_KEY environment variable or provide apiKey in TCCCallbackHandler config"
      );
    }

    this.apiKey = apiKey;
    this.endpoint =
      config.endpoint ||
      getTCCUrl(
        apiKey,
        "https://api.thecontext.company/v1/custom",
        "https://dev.thecontext.company/v1/custom"
      );
    this.fixedRunId = config.runId;
    this.sessionId = config.sessionId;
    this.conversational = config.conversational ?? false;
    this.customMetadata = config.metadata || {};
    this.debugEnabled = config.debug ?? false;
  }

  private debug(...args: unknown[]): void {
    if (!this.debugEnabled) return;
    console.log(
      "[TCC LangGraph]",
      ...args.map((a) =>
        typeof a === "object" && a !== null
          ? JSON.stringify(a, null, 2)
          : String(a)
      )
    );
  }

  private getInvocation(runId: string): InvocationState | undefined {
    const rootId = this.spanToRoot.get(runId);
    return rootId ? this.invocations.get(rootId) : undefined;
  }

  private recordSpan(
    runId: string,
    parentRunId: string | undefined,
    kind: SpanRecord["kind"],
    name: string,
    input?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    let rootId: string;

    if (parentRunId && this.spanToRoot.has(parentRunId)) {
      rootId = this.spanToRoot.get(parentRunId)!;
    } else {
      rootId = runId;
      if (!this.invocations.has(rootId)) {
        this.invocations.set(rootId, {
          tccRunId: this.fixedRunId || crypto.randomUUID(),
          spans: new Map(),
          startTimes: new Map(),
          firstTokenTimes: new Map(),
          skippedRuns: new Set(),
        });
      }
    }

    this.spanToRoot.set(runId, rootId);
    const inv = this.invocations.get(rootId)!;

    inv.spans.set(runId, {
      name,
      kind,
      startTime: new Date(),
      parentRunId,
      input,
      metadata,
    });

    this.debug(`Started ${kind}: ${name} (${runId})`);
  }

  private endSpan(
    runId: string,
    output?: unknown,
    error?: Error,
    extra?: Partial<SpanRecord>
  ): void {
    const inv = this.getInvocation(runId);
    if (!inv) return;

    if (inv.skippedRuns.has(runId)) {
      inv.skippedRuns.delete(runId);
      inv.spans.delete(runId);
      this.spanToRoot.delete(runId);
      return;
    }

    const span = inv.spans.get(runId);
    if (!span) return;

    span.endTime = new Date();
    span.output = output;
    span.error = error;
    if (extra) Object.assign(span, extra);

    this.debug(`Ended ${span.kind}: ${span.name} (${runId})`);

    const rootId = this.spanToRoot.get(runId);
    if (runId === rootId) {
      this.flushInvocation(rootId).catch((err) =>
        console.error("[TCC LangGraph] Flush error:", err)
      );
    }
  }

  // --- LLM callbacks ---

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runName?: string
  ): Promise<void> {
    const name = runName ?? llm.name ?? llm.id.at(-1)?.toString() ?? "LLM";
    this.recordSpan(runId, parentRunId, "llm", name, prompts, metadata);

    const inv = this.getInvocation(runId);
    if (inv) {
      inv.startTimes.set(runId, Date.now());
      const span = inv.spans.get(runId);
      if (span) {
        span.tags = tags;
        span.serialized = llm;
        span.extraParams = extraParams;
        const invocationParams = extraParams?.invocation_params as
          | Record<string, unknown>
          | undefined;
        if (invocationParams?.model) {
          span.model = invocationParams.model as string;
        }
      }
    }
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runName?: string
  ): Promise<void> {
    const name =
      runName ?? llm.name ?? llm.id.at(-1)?.toString() ?? "Chat Model";
    this.recordSpan(runId, parentRunId, "llm", name, messages, metadata);

    const inv = this.getInvocation(runId);
    if (inv) {
      inv.startTimes.set(runId, Date.now());
      const span = inv.spans.get(runId);
      if (span) {
        span.tags = tags;
        span.serialized = llm;
        span.extraParams = extraParams;
        const invocationParams = extraParams?.invocation_params as
          | Record<string, unknown>
          | undefined;
        if (invocationParams?.model) {
          span.model = invocationParams.model as string;
        }
      }
    }
  }

  async handleLLMEnd(
    output: LLMResult | ChatResult,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    const inv = this.getInvocation(runId);
    const tokens = getTokensFromResponse(output);
    const modelUsed = getModelFromResponse(output);
    const finishReason = getFinishReasonFromResponse(output);

    let ttftMs: number | undefined;
    if (inv) {
      const startTime = inv.startTimes.get(runId);
      const firstToken = inv.firstTokenTimes.get(runId);
      if (startTime !== undefined && firstToken !== undefined) {
        ttftMs = firstToken - startTime;
      }
      inv.startTimes.delete(runId);
      inv.firstTokenTimes.delete(runId);
    }

    this.endSpan(runId, output, undefined, {
      modelUsed,
      finishReason,
      promptTokens: tokens.prompt,
      completionTokens: tokens.completion,
      cachedTokens: tokens.cached,
      ttftMs,
    });
  }

  async handleLLMError(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    const inv = this.getInvocation(runId);
    if (inv) {
      inv.startTimes.delete(runId);
      inv.firstTokenTimes.delete(runId);
    }
    this.endSpan(runId, undefined, err, { finishReason: "error" });
  }

  async handleLLMNewToken(
    _token: string,
    _idx: { prompt: number; completion: number },
    runId: string
  ): Promise<void> {
    const inv = this.getInvocation(runId);
    if (inv && !inv.firstTokenTimes.has(runId)) {
      inv.firstTokenTimes.set(runId, Date.now());
    }
  }

  // --- Chain callbacks ---

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runType?: string,
    runName?: string
  ): Promise<void> {
    if (tags?.includes("langsmith:hidden")) {
      if (parentRunId) {
        const inv = this.getInvocation(parentRunId);
        if (inv) {
          inv.skippedRuns.add(runId);
          this.spanToRoot.set(runId, this.spanToRoot.get(parentRunId)!);
        }
      }
      return;
    }

    const name =
      runName ?? chain?.name ?? chain.id.at(-1)?.toString() ?? "Chain";
    this.recordSpan(runId, parentRunId, "chain", name, inputs, metadata);

    const inv = this.getInvocation(runId);
    if (inv) {
      const span = inv.spans.get(runId);
      if (span) {
        span.tags = tags;
        span.serialized = chain;
      }
    }
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, outputs);
  }

  async handleChainError(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, undefined, err);
  }

  // --- Tool callbacks ---

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runName?: string
  ): Promise<void> {
    const name = runName ?? tool.name ?? tool.id.at(-1)?.toString() ?? "Tool";
    this.recordSpan(runId, parentRunId, "tool", name, input, metadata);

    const inv = this.getInvocation(runId);
    if (inv) {
      const span = inv.spans.get(runId);
      if (span) {
        span.tags = tags;
        span.serialized = tool;
      }
    }
  }

  async handleToolEnd(
    output: unknown,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, output);
  }

  async handleToolError(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, undefined, err);
  }

  // --- Agent callbacks ---

  async handleAgentAction(
    action: AgentAction,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.recordSpan(runId, parentRunId, "agent", action.tool, action);
  }

  async handleAgentEnd(
    action: AgentFinish,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, action);
  }

  // --- Retriever callbacks ---

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string
  ): Promise<void> {
    const resolvedName =
      name ?? retriever.name ?? retriever.id.at(-1)?.toString() ?? "Retriever";
    this.recordSpan(
      runId,
      parentRunId,
      "retriever",
      resolvedName,
      query,
      metadata
    );
  }

  async handleRetrieverEnd(
    documents: DocumentInterface[],
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, documents);
  }

  async handleRetrieverError(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    this.endSpan(runId, undefined, err);
  }

  // --- Flush / Send ---

  private async flushInvocation(rootId: string): Promise<void> {
    const inv = this.invocations.get(rootId);
    if (!inv || inv.spans.size === 0) return;

    const rootSpan = inv.spans.get(rootId);
    const tccRunId = inv.tccRunId;

    const items: (RunPayload | StepPayload | ToolCallPayload)[] = [];

    const runStartTime = rootSpan?.startTime ?? new Date();
    const runEndTime = rootSpan?.endTime ?? new Date();
    const hasError = rootSpan?.error !== undefined;

    const userPrompt = rootSpan ? extractRunUserPrompt(rootSpan.input) : "";
    const response = rootSpan ? extractRunResponse(rootSpan.output) : "";

    const runDurationMs = runEndTime.getTime() - runStartTime.getTime();

    const runAttributes: Record<string, unknown> = {
      "langgraph.graph_name": rootSpan?.name,
      "langgraph.duration_ms": runDurationMs,
      "langgraph.total_spans": inv.spans.size,
      "langgraph.framework": "langgraph-js",
    };
    if (rootSpan?.tags?.length) runAttributes["langgraph.tags"] = rootSpan.tags;
    if (rootSpan?.metadata) {
      Object.assign(
        runAttributes,
        flattenObject(rootSpan.metadata, "metadata")
      );
    }
    if (rootSpan?.serialized) {
      runAttributes["langgraph.serialized_id"] = rootSpan.serialized.id;
      if (rootSpan.serialized.name)
        runAttributes["langgraph.serialized_name"] = rootSpan.serialized.name;
    }

    const runPayload: RunPayload = {
      type: "run",
      run_id: tccRunId,
      start_time: runStartTime.toISOString(),
      end_time: runEndTime.toISOString(),
      prompt: { user_prompt: userPrompt },
      response,
      status_code: hasError ? 2 : 0,
      status_message: rootSpan?.error?.message,
      session_id: this.sessionId,
      conversational: this.conversational,
      metadata: this.customMetadata,
      attributes: runAttributes,
    };
    items.push(runPayload);

    for (const [spanId, span] of inv.spans) {
      if (!span.endTime) continue;
      const durationMs = span.endTime.getTime() - span.startTime.getTime();

      if (span.kind === "llm") {
        const attrs: Record<string, unknown> = {
          "llm.name": span.name,
          "llm.duration_ms": durationMs,
          "llm.run_id": spanId,
        };

        if (span.tags?.length) attrs["llm.tags"] = span.tags;
        if (span.metadata) {
          Object.assign(attrs, flattenObject(span.metadata, "llm.metadata"));
        }
        if (span.serialized) {
          attrs["llm.serialized_id"] = span.serialized.id;
          if (span.serialized.name)
            attrs["llm.serialized_name"] = span.serialized.name;
        }
        if (span.extraParams) {
          Object.assign(attrs, flattenObject(span.extraParams, "llm.params"));
        }
        if (span.ttftMs !== undefined) attrs["llm.ttft_ms"] = span.ttftMs;

        Object.assign(attrs, extractLLMOutputAttributes(span.output));

        const stepPayload: StepPayload = {
          type: "step",
          run_id: tccRunId,
          step_id: spanId,
          start_time: span.startTime.toISOString(),
          end_time: span.endTime.toISOString(),
          prompt: extractLLMPrompt(span.input),
          response: extractLLMResponse(span.output),
          status_code: span.error ? 2 : 0,
          status_message: span.error?.message,
          model_requested: span.model,
          model_used: span.modelUsed ?? span.model,
          finish_reason: span.finishReason ?? "stop",
          prompt_uncached_tokens:
            (span.promptTokens ?? 0) - (span.cachedTokens ?? 0),
          prompt_cached_tokens: span.cachedTokens ?? 0,
          completion_tokens: span.completionTokens ?? 0,
          ttft_ms: span.ttftMs,
          attributes: attrs,
        };
        items.push(stepPayload);
      } else if (span.kind === "tool") {
        const attrs: Record<string, unknown> = {
          "tool.name": span.name,
          "tool.duration_ms": durationMs,
          "tool.run_id": spanId,
        };
        if (span.tags?.length) attrs["tool.tags"] = span.tags;
        if (span.metadata) {
          Object.assign(attrs, flattenObject(span.metadata, "tool.metadata"));
        }
        if (span.serialized) {
          attrs["tool.serialized_id"] = span.serialized.id;
          if (span.serialized.name)
            attrs["tool.serialized_name"] = span.serialized.name;
        }

        const toolPayload: ToolCallPayload = {
          type: "tool_call",
          run_id: tccRunId,
          tool_call_id: spanId,
          tool_name: span.name,
          start_time: span.startTime.toISOString(),
          end_time: span.endTime.toISOString(),
          status_code: span.error ? 2 : 0,
          status_message: span.error?.message,
          args: safeStringify(span.input),
          result: extractToolResult(span.output),
          attributes: attrs,
        };
        items.push(toolPayload);
      }
    }

    const payload: BatchPayload = { type: "batch", items };

    this.debug(`Flushing ${items.length} items for run ${tccRunId}`);

    await this.send(payload);

    for (const spanId of inv.spans.keys()) {
      this.spanToRoot.delete(spanId);
    }
    for (const skippedId of inv.skippedRuns) {
      this.spanToRoot.delete(skippedId);
    }
    this.invocations.delete(rootId);
  }

  async flush(): Promise<void> {
    const rootIds = [...this.invocations.keys()];
    for (const rootId of rootIds) {
      await this.flushInvocation(rootId);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  private async send(payload: BatchPayload): Promise<void> {
    const body = JSON.stringify(payload);
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        this.debug(`Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
      }

      try {
        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
        });

        if (res.ok) {
          this.debug("Successfully sent trace data");
          return;
        }

        const text = await res.text();
        if (res.status !== 429 && res.status < 500) {
          console.error(
            `[TCC LangGraph] Ingestion failed (${res.status}): ${text}`
          );
          return;
        }

        lastError = `${res.status}: ${text}`;
        this.debug(`Retryable error: ${lastError}`);
      } catch (err) {
        lastError = err;
        this.debug("Network error, will retry:", err);
      }
    }

    console.error(
      `[TCC LangGraph] Ingestion failed after ${MAX_RETRIES + 1} attempts:`,
      lastError
    );
  }
}
