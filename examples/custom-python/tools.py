"""
Mock tool implementations.

In production these would hit real services — internal APIs, databases, ticket
systems, etc. Here they return canned data so the example runs without any
external dependencies.
"""

import json

# ---------------------------------------------------------------------------
# Tool handlers (mock)
# ---------------------------------------------------------------------------

def search_knowledge_base(query: str) -> str:
    KNOWLEDGE = {
        "q3": ["Q3 2024 Report.pdf", "Revenue Dashboard", "Churn Analysis Deck"],
        "onboarding": ["Onboarding Playbook v3", "Customer Success Runbook"],
        "pricing": ["Pricing Page Copy", "Enterprise Tier Breakdown"],
    }
    key = next((k for k in KNOWLEDGE if k in query.lower()), None)
    results = KNOWLEDGE.get(key, ["No results found"])
    return json.dumps({"query": query, "results": results})


def query_database(sql: str) -> str:
    return json.dumps({
        "sql": sql,
        "rows": [
            {"quarter": "Q3", "revenue": 4200000, "churn_rate": 0.031, "nps": 72},
            {"quarter": "Q2", "revenue": 3560000, "churn_rate": 0.044, "nps": 65},
        ],
    })


def create_ticket(title: str, priority: str = "medium") -> str:
    return json.dumps({
        "ticket_id": "ENG-4521",
        "title": title,
        "priority": priority,
        "status": "created",
        "assigned_to": "oncall-team",
    })


def send_email(to: str, subject: str, body: str = "") -> str:
    return json.dumps({
        "message_id": "msg-9182",
        "to": to,
        "subject": subject,
        "status": "sent",
    })


# ---------------------------------------------------------------------------
# Registry — maps function names to callables
# ---------------------------------------------------------------------------

TOOL_HANDLERS = {
    "search_knowledge_base": lambda args: search_knowledge_base(**args),
    "query_database": lambda args: query_database(**args),
    "create_ticket": lambda args: create_ticket(**args),
    "send_email": lambda args: send_email(**args),
}


def execute_tool(name: str, arguments: dict) -> str:
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {name}"})
    return handler(arguments)
