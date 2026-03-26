import {
  context,
  trace,
  type ContextManager,
  type Tracer,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { TCCSpanProcessor } from "../TCCSpanProcessor";
import { debug, setDebug } from "../internal/logger";

const DEFAULT_TRACER_NAME = "tcc-workers";
const DEFAULT_PROD_TRACES_URL = "https://api.thecontext.company/v1/traces";
const DEFAULT_DEV_TRACES_URL = "https://dev.thecontext.company/v1/traces";

type CachedTracing = {
  apiKey: string;
  provider: BasicTracerProvider;
  url: string;
};

export type WorkersEnv = {
  TCC_API_KEY?: string | null | undefined;
};

export type RegisterOpts = {
  url?: string;
  apiKey?: string;
  baseProcessor?: SpanProcessor;
  debug?: boolean;
  contextManager?: ContextManager;
  installContextManager?: boolean;
};

export type GetTracerOpts = RegisterOpts & {
  tracerName?: string;
};

export type WaitUntilLike = {
  waitUntil(promise: Promise<unknown>): void;
};

let cachedTracing: CachedTracing | undefined;
let didSetGlobalContextManager = false;
let didSetGlobalTracerProvider = false;
let didLogContextManagerConflict = false;
let didLogTracerProviderConflict = false;

function resolveApiKey(
  env: WorkersEnv | undefined,
  apiKey: string | undefined,
): string | undefined {
  const resolved = apiKey ?? env?.TCC_API_KEY;
  if (typeof resolved !== "string") return undefined;

  const trimmed = resolved.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveOtlpUrl(apiKey: string, url: string | undefined): string {
  if (url) return url;
  return apiKey.startsWith("dev_")
    ? DEFAULT_DEV_TRACES_URL
    : DEFAULT_PROD_TRACES_URL;
}

function createDefaultContextManager(): ContextManager {
  return new AsyncLocalStorageContextManager().enable();
}

function ensureTracerProvider(
  env: WorkersEnv | undefined,
  opts: RegisterOpts = {},
): CachedTracing | undefined {
  if (opts.debug) setDebug(true);

  const apiKey = resolveApiKey(env, opts.apiKey);
  if (!apiKey) {
    debug(
      "Skipping Cloudflare Workers tracing because no TCC API key was provided.",
    );
    return undefined;
  }

  const url = resolveOtlpUrl(apiKey, opts.url);

  if (
    !cachedTracing ||
    cachedTracing.apiKey !== apiKey ||
    cachedTracing.url !== url
  ) {
    cachedTracing = {
      apiKey,
      provider: new BasicTracerProvider({
        spanProcessors: [
          new TCCSpanProcessor({
            apiKey,
            otlpUrl: url,
            baseProcessor: opts.baseProcessor,
            debug: opts.debug,
          }),
        ],
      }),
      url,
    };
    debug("Created Cloudflare Workers tracer provider.");
  }

  if (opts.installContextManager !== false && !didSetGlobalContextManager) {
    const contextManager = opts.contextManager ?? createDefaultContextManager();
    const didSet = context.setGlobalContextManager(contextManager);
    didSetGlobalContextManager = didSet || didSetGlobalContextManager;

    if (didSet) {
      debug("Registered AsyncLocalStorage context manager for Workers.");
    } else if (!didLogContextManagerConflict) {
      debug("Global context manager already exists; reusing the active manager.");
      didLogContextManagerConflict = true;
    }
  }

  if (!didSetGlobalTracerProvider) {
    const didSet = trace.setGlobalTracerProvider(cachedTracing.provider);
    didSetGlobalTracerProvider = didSet || didSetGlobalTracerProvider;

    if (didSet) {
      debug("Registered global tracer provider for Workers.");
    } else if (!didLogTracerProviderConflict) {
      debug("Global tracer provider already exists; using explicit tracer fallback.");
      didLogTracerProviderConflict = true;
    }
  }

  return cachedTracing;
}

/**
 * Idempotently registers TCC tracing for Cloudflare Workers and Durable Objects.
 *
 * Safe to call in every request handler or Durable Object constructor.
 * If no API key is available, this becomes a no-op.
 */
export function registerOTelTCC(
  env?: WorkersEnv,
  opts: RegisterOpts = {},
): void {
  ensureTracerProvider(env, opts);
}

/**
 * Returns a tracer backed by TCC's span processor.
 *
 * This is useful when you want to pass an explicit tracer to Vercel AI SDK
 * `experimental_telemetry` options inside Workers or Durable Objects.
 */
export function getTCCTracer(
  env?: WorkersEnv,
  opts: GetTracerOpts = {},
): Tracer | undefined {
  const tracing = ensureTracerProvider(env, opts);
  if (!tracing) return undefined;

  return tracing.provider.getTracer(opts.tracerName ?? DEFAULT_TRACER_NAME);
}

/**
 * Flushes the cached tracer provider, if one has been created.
 */
export async function flushTCCTracing(): Promise<void> {
  if (!cachedTracing) {
    debug("Skipping forceFlush because no tracer provider was created.");
    return;
  }

  await cachedTracing.provider.forceFlush();
}

/**
 * Schedules a forceFlush on any Cloudflare context-like object that exposes
 * `waitUntil()`, such as ExecutionContext or DurableObjectState.
 */
export function scheduleTCCFlush(ctx: WaitUntilLike): void {
  ctx.waitUntil(flushTCCTracing());
}
