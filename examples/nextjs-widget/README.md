# Next.js + AI SDK + The Context Company Widget

A Next.js example demonstrating The Context Company (TCC) local widget integration with the Vercel AI SDK, featuring real-time telemetry visualization during development.

## Overview

This example showcases:

- **Local Widget Development Mode**: Real-time trace visualization in your browser during development
- TCC OpenTelemetry integration with Next.js and AI SDK
- Simple AI chat interface with tool calling
- Automatic telemetry collection without external dashboard setup

## Key Features

### The Context Company Widget

The standout feature of this example is the **local widget** that provides instant observability during development:

- **Zero Configuration**: Automatically loads in development mode
- **Real-Time Traces**: See AI interactions, tool calls, and performance metrics as they happen
- **In-Browser Dashboard**: No need to switch to external tools while developing
- **Local-First**: All telemetry stays on your machine during development

## Getting Started

### Prerequisites

- Node.js 18+ or compatible runtime
- OpenAI API key

### Installation

1. **Navigate to the example:**

```bash
cd examples/nextjs-widget
```

2. **Install dependencies:**

```bash
npm install
# or
pnpm install
# or
yarn install
```

3. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

4. **Run the development server:**

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Using the Widget

Once your app is running in development mode:

1. **Open the chat interface** at `http://localhost:3000`
2. **Look for the TCC Widget** - it appears as an overlay on the top-right corner
3. **Send a message** like "What's the weather in Tokyo?"
4. **Watch the widget** update in real-time with:
   - Trace details
   - Token usage
   - Latency metrics
   - Tool call execution
5. **Try triggering an error** with "Create a ticket for bug fix" to see error tracking

### Example Prompts

**Weather Queries:**

- "What's the weather in San Francisco?"
- "Tell me the weather in London"

**Error Testing:**

- "Create a ticket for bug fix"
- "Make a new ticket titled 'Feature request'"

## Architecture

### Project Structure

```
examples/nextjs-widget/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Chat endpoint with tools
│   ├── layout.tsx                # Root layout with widget script
│   ├── page.tsx                  # Main chat interface
│   └── globals.css               # Styles
├── instrumentation.ts            # TCC OpenTelemetry setup
├── proxy.ts                      # Edge runtime activation
└── package.json
```

### Key Implementation Details

#### Widget Integration

Located in `app/layout.tsx:30-32`:

```typescript
{process.env.NODE_ENV === "development" && (
  <Script src="https://unpkg.com/@contextcompany/widget/dist/auto.global.js" />
)}
```

This conditionally loads the widget only in development mode, keeping your production bundle clean.

#### Local Mode Telemetry

Located in `instrumentation.ts:4`:

```typescript
registerOTelTCC({ local: true });
```

The `local: true` option configures telemetry to work with the local widget instead of sending data to a remote server.

## Learn More

- [The Context Company Widget Documentation](https://docs.thecontext.company/frameworks/ai-sdk/local)
- [OpenTelemetry](https://opentelemetry.io/)

## License

MIT
