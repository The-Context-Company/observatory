import { OpenClawCollector } from "./collector";

// ---------------------------------------------------------------------------
// Argument parsing (no external dependencies)
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--debug" || arg === "-d") {
      args.debug = true;
    } else if (arg === "--port" || arg === "-p") {
      args.port = argv[++i] ?? "";
    } else if (arg === "--host") {
      args.host = argv[++i] ?? "";
    } else if (arg === "--api-key") {
      args.apiKey = argv[++i] ?? "";
    } else if (arg === "--endpoint") {
      args.endpoint = argv[++i] ?? "";
    } else if (arg.startsWith("--port=")) {
      args.port = arg.split("=")[1];
    } else if (arg.startsWith("--host=")) {
      args.host = arg.split("=")[1];
    } else if (arg.startsWith("--api-key=")) {
      args.apiKey = arg.split("=")[1];
    } else if (arg.startsWith("--endpoint=")) {
      args.endpoint = arg.split("=")[1];
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
@contextcompany/openclaw — OTLP Collector for OpenClaw

Receives OpenTelemetry traces from OpenClaw and forwards them to
The Context Company's API.

USAGE
  npx @contextcompany/openclaw [options]
  openclaw-collector [options]

OPTIONS
  -p, --port <port>       Port to listen on (default: 4318)
      --host <host>       Host to bind to (default: 0.0.0.0)
      --api-key <key>     TCC API key (or set TCC_API_KEY env var)
      --endpoint <url>    Custom TCC endpoint URL
  -d, --debug             Enable debug logging
  -h, --help              Show this help message

OPENCLAW CONFIGURATION
  Add the following to ~/.openclaw/openclaw.json:

  {
    "diagnostics": {
      "otel": {
        "enabled": true,
        "endpoint": "http://localhost:4318",
        "protocol": "http/json",
        "traces": true,
        "captureContent": true
      }
    }
  }

  Or enable via CLI:
    openclaw plugins enable diagnostics-otel

ENVIRONMENT VARIABLES
  TCC_API_KEY             Your Context Company API key
  TCC_URL                 Custom TCC endpoint (overrides auto-detection)

EXAMPLES
  # Start with defaults
  npx @contextcompany/openclaw

  # Custom port with debug logging
  npx @contextcompany/openclaw --port 9318 --debug

  # With explicit API key
  npx @contextcompany/openclaw --api-key tcc_abc123
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const port = args.port ? parseInt(String(args.port), 10) : undefined;
  if (port !== undefined && (isNaN(port) || port < 1 || port > 65535)) {
    console.error(`[TCC OpenClaw] Invalid port: ${args.port}`);
    process.exit(1);
  }

  const collector = new OpenClawCollector({
    port,
    host: typeof args.host === "string" ? args.host : undefined,
    apiKey: typeof args.apiKey === "string" ? args.apiKey : undefined,
    endpoint: typeof args.endpoint === "string" ? args.endpoint : undefined,
    debug: args.debug === true,
  });

  // Graceful shutdown on SIGINT/SIGTERM
  const shutdown = async () => {
    console.log("\n[TCC OpenClaw] Shutting down...");
    await collector.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await collector.start();
}

main().catch((err) => {
  console.error("[TCC OpenClaw] Fatal error:", err);
  process.exit(1);
});
