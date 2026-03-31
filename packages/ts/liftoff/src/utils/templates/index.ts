import type { Framework, WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

export type { FileOperation, TemplateResult } from "./types.js";

/**
 * Get the deterministic instrumentation template for a given framework.
 *
 * Each template generates the correct instrumentation file(s) for its
 * framework. Templates are the fast fallback when AI is unavailable
 * (user declines, no auth, or --key mode).
 *
 * Uses dynamic imports to avoid loading all 12 templates at startup.
 */
export async function getTemplate(
  framework: Framework,
  ctx: WizardContext,
): Promise<TemplateResult> {
  switch (framework) {
    case "nextjs-aisdk": {
      const mod = await import("./nextjs-aisdk.js");
      return mod.getTemplate(ctx);
    }
    case "claude-agent-sdk": {
      const mod = await import("./claude-agent-sdk.js");
      return mod.getTemplate(ctx);
    }
    case "langchain-ts": {
      const mod = await import("./langchain-ts.js");
      return mod.getTemplate(ctx);
    }
    case "mastra": {
      const mod = await import("./mastra.js");
      return mod.getTemplate(ctx);
    }
    case "custom-ts": {
      const mod = await import("./custom-ts.js");
      return mod.getTemplate(ctx);
    }
    case "pi-mono": {
      const mod = await import("./pi-mono.js");
      return mod.getTemplate(ctx);
    }
    case "openclaw": {
      const mod = await import("./openclaw.js");
      return mod.getTemplate(ctx);
    }
    case "langchain-python": {
      const mod = await import("./langchain-python.js");
      return mod.getTemplate(ctx);
    }
    case "crewai": {
      const mod = await import("./crewai.js");
      return mod.getTemplate(ctx);
    }
    case "agno": {
      const mod = await import("./agno.js");
      return mod.getTemplate(ctx);
    }
    case "litellm": {
      const mod = await import("./litellm.js");
      return mod.getTemplate(ctx);
    }
    case "custom-python": {
      const mod = await import("./custom-python.js");
      return mod.getTemplate(ctx);
    }
    default: {
      const _exhaustive: never = framework;
      throw new Error(`No template for framework: ${_exhaustive}`);
    }
  }
}
