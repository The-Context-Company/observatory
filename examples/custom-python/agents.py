"""
Agent definitions for the multi-agent orchestration framework.

Each agent has a system prompt, a model, and an optional set of tools
it can call. The router agent has a special "handoff" tool that signals
the orchestrator to delegate to a specialist.
"""

# ---------------------------------------------------------------------------
# Tool schemas (OpenAI function-calling format, used by LiteLLM)
# ---------------------------------------------------------------------------

HANDOFF_TOOL = {
    "type": "function",
    "function": {
        "name": "handoff",
        "description": "Route this request to a specialist agent.",
        "parameters": {
            "type": "object",
            "properties": {
                "agent": {
                    "type": "string",
                    "enum": ["research", "action"],
                    "description": "Which specialist agent to hand off to.",
                },
                "reason": {
                    "type": "string",
                    "description": "Brief reason for the handoff.",
                },
            },
            "required": ["agent"],
        },
    },
}

RESEARCH_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search the internal knowledge base for documents and reports.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_database",
            "description": "Run a read-only SQL query against the analytics database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "SQL SELECT query."},
                },
                "required": ["sql"],
            },
        },
    },
]

ACTION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_ticket",
            "description": "Create an engineering ticket.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send an email to a team member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["to", "subject"],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Agent configs
# ---------------------------------------------------------------------------

AGENTS = {
    "router": {
        "model": "gpt-4o",
        "system_prompt": (
            "You are a Router Agent in a multi-agent system. Your job is to "
            "decide which specialist handles the user's request.\n\n"
            "- Use the 'handoff' tool with agent='research' for questions about "
            "data, metrics, reports, or lookups.\n"
            "- Use the 'handoff' tool with agent='action' for requests to create "
            "tickets, send emails, or take actions.\n"
            "- If the request is simple enough, answer directly without a handoff."
        ),
        "tools": [HANDOFF_TOOL],
    },
    "research": {
        "model": "gpt-4o-mini",
        "system_prompt": (
            "You are a Research Agent. Use the provided tools to look up "
            "information and answer the user's question with data. "
            "Always cite your sources."
        ),
        "tools": RESEARCH_TOOLS,
    },
    "action": {
        "model": "gpt-4o-mini",
        "system_prompt": (
            "You are an Action Agent. Use the provided tools to take actions "
            "on behalf of the user. Confirm what you did after completing the action."
        ),
        "tools": ACTION_TOOLS,
    },
}
