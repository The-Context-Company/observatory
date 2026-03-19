import type { OpenClawSpan, SpanClassification } from "./types";

/**
 * Classify an OpenClaw span into a TCC span type.
 *
 * Classification rules (evaluated in order):
 *
 * 1. **run** — root request span (`openclaw.request`)
 * 2. **agent_turn** — agent iteration span (`openclaw.agent.turn`)
 * 3. **step** — LLM inference call (name starts with `chat `, or has
 *    `openclaw.model` / `gen_ai.request.model` attributes)
 * 4. **tool_call** — tool/function execution (name starts with `tool.` or
 *    `execute_tool `)
 * 5. **unknown** — everything else
 */
export function classifySpan(span: OpenClawSpan): SpanClassification {
  const name = span.name;

  // Root request span
  if (name === "openclaw.request") return "run";

  // Agent turn (intermediate grouping)
  if (name === "openclaw.agent.turn") return "agent_turn";

  // LLM call — "chat <model>" pattern
  if (name.startsWith("chat ")) return "step";

  // LLM call — fallback detection via attributes
  if (
    span.attributes["openclaw.model"] !== undefined ||
    span.attributes["gen_ai.request.model"] !== undefined ||
    span.attributes["gen_ai.operation.name"] !== undefined
  ) {
    return "step";
  }

  // Tool execution — "tool.<name>" or "execute_tool <name>"
  if (name.startsWith("tool.") || name.startsWith("execute_tool ")) {
    return "tool_call";
  }

  return "unknown";
}

/**
 * Extract a human-readable tool name from a tool span.
 *
 * - `tool.Read` → `"Read"`
 * - `tool.exec` → `"exec"`
 * - `tool.web_search` → `"web_search"`
 * - `execute_tool read_file` → `"read_file"`
 */
export function extractToolName(span: OpenClawSpan): string {
  const name = span.name;

  if (name.startsWith("tool.")) {
    return name.slice("tool.".length) || "unknown";
  }

  if (name.startsWith("execute_tool ")) {
    return name.slice("execute_tool ".length) || "unknown";
  }

  return name;
}

/**
 * Extract the model name from an LLM step span.
 *
 * Checks (in order): `openclaw.model`, `gen_ai.request.model`, then falls
 * back to parsing the span name (e.g. `"chat gpt-5.2"` → `"gpt-5.2"`).
 */
export function extractModelName(span: OpenClawSpan): string | undefined {
  const model = span.attributes["openclaw.model"];
  if (typeof model === "string" && model.length > 0) return model;

  const genAiModel = span.attributes["gen_ai.request.model"];
  if (typeof genAiModel === "string" && genAiModel.length > 0)
    return genAiModel;

  // Parse from span name: "chat gpt-5.2" → "gpt-5.2"
  if (span.name.startsWith("chat ")) {
    return span.name.slice("chat ".length) || undefined;
  }

  return undefined;
}
