# @contextcompany/liftoff

Interactive setup for The Context Company observability. Liftoff detects your AI framework and package manager, helps provision an API key, and gives your coding agent the instructions needed to instrument the project.

## Run

From the project you want to instrument:

```bash
npx @contextcompany/liftoff
```

Liftoff guides you through:

1. Signing in to The Context Company
2. Detecting or selecting your framework and language
3. Provisioning an API key
4. Copying the correct instrumentation prompt
5. Optionally configuring MCP and Slack

It supports TypeScript and Python integrations, including Vercel AI SDK, LangChain and LangGraph, Claude Agent SDK, Mastra, Pi, OpenClaw, CrewAI, Agno, and custom instrumentation.

## Options

```text
--api-base <url>  Override the TCC API base URL
--help, -h        Show help
--version         Show the installed version
```

Node.js 18 or later is required. Authentication opens a browser and returns to a temporary local callback server. You can skip sign-in and add `TCC_API_KEY` manually instead.

See the complete [The Context Company documentation](https://docs.thecontextcompany.com).
