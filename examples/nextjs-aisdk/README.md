# Next.js, AI SDK 7, and The Context Company

A complete AI SDK 7 example with streaming, multi-step tools, The Context Company observability, sessions, user and organization metadata, and feedback.

## Requirements

- Node.js 22 or newer
- An OpenAI API key
- A TCC API key for production ingestion, or TCC local mode

## Run the example

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Set these values in `.env`:

```bash
OPENAI_API_KEY=your_openai_api_key
TCC_API_KEY=your_tcc_api_key
TCC_EXAMPLE_API_TOKEN=choose_a_local_demo_token
NEXT_PUBLIC_TCC_EXAMPLE_API_TOKEN=choose_a_local_demo_token
```

The example API routes require the demo token by default. For throwaway local-only testing, you can set `TCC_ALLOW_UNAUTHENTICATED_EXAMPLE_APIS=1`. Do not use that setting in a deployed example.

## How the integration works

`src/instrumentation.ts` performs one global registration for the AI SDK 7 native OpenTelemetry integration and the TCC exporter:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerTCC } = await import("@contextcompany/ai-sdk/nextjs");
    registerTCC();
  }
}
```

The chat route uses `tccTelemetry` to include tracking data in stable AI SDK 7 telemetry:

```ts
const runId = crypto.randomUUID();

const result = streamText({
  model,
  messages,
  tools,
  stopWhen: isStepCount(10),
  ...tccTelemetry({
    metadata: {
      "tcc.runId": runId,
      "tcc.sessionId": sessionId,
      "tcc.agent": "weather-assistant",
      "tcc.userId": "1234567890",
      "tcc.userName": "John Doe",
      "tcc.orgId": "178943",
      "tcc.orgName": "Acme Inc",
      yourCustomMetadata: "yourCustomValue",
    },
  }),
});
```

The resulting trace contains one run, one step for every model call, and one record for every tool execution. The run ID is returned in message metadata so feedback can be associated with the correct interaction.

## Local mode

To inspect traces locally without a production API key, change registration to:

```ts
registerTCC({ local: true });
```

## Important files

- `src/instrumentation.ts`: global TCC and AI SDK registration
- `src/app/api/chat/route.ts`: streaming agent, tracking metadata, and run ID propagation
- `src/app/api/chat/agent.ts`: weather tools
- `src/app/api/feedback/route.ts`: feedback submission linked to a run
- `src/components/feedback-buttons.tsx`: thumbs up, thumbs down, and comments

## Verification

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

After sending a prompt that invokes a tool, confirm the TCC dashboard shows:

- One run with the correct session, user, organization, and custom metadata
- Multiple model steps when the agent loops
- Tool arguments and results
- Input, cached, and output token usage
- Feedback associated with the returned run ID

## Documentation

- [TCC AI SDK 7 guide](https://docs.thecontextcompany.com/frameworks/vercel-ai-sdk)
- [Vercel AI SDK documentation](https://ai-sdk.dev/docs)
