"""Support agent with customer service tools."""

from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# Mock data
MOCK_USERS = {
    "user-001": {
        "id": "user-001",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "tier": "premium",
        "status": "active",
        "joinedAt": "2023-01-15",
    },
    "user-002": {
        "id": "user-002",
        "name": "Bob Smith",
        "email": "bob@example.com",
        "tier": "free",
        "status": "active",
        "joinedAt": "2023-06-20",
    },
    "user-003": {
        "id": "user-003",
        "name": "Carol White",
        "email": "carol@example.com",
        "tier": "enterprise",
        "status": "suspended",
        "joinedAt": "2022-11-10",
    },
}

MOCK_TICKETS = {
    "ticket-001": {
        "id": "ticket-001",
        "userId": "user-001",
        "subject": "Cannot access dashboard",
        "status": "open",
        "priority": "high",
        "category": "technical",
        "createdAt": "2024-01-10",
    },
    "ticket-002": {
        "id": "ticket-002",
        "userId": "user-002",
        "subject": "Billing question",
        "status": "closed",
        "priority": "low",
        "category": "billing",
        "createdAt": "2024-01-05",
    },
}


@tool
def get_user_profile(user_id: str) -> dict:
    """
    Retrieve detailed information about a user account.

    Args:
        user_id: The unique identifier of the user (e.g., 'user-001')

    Returns:
        User profile information including name, email, tier, and status
    """
    user = MOCK_USERS.get(user_id)
    if user:
        return {"success": True, "user": user}
    return {"success": False, "error": f"User {user_id} not found"}


@tool
def create_ticket(
    user_id: str, subject: str, priority: str = "medium", category: str = "general"
) -> dict:
    """
    Create a new support ticket for a user.

    Args:
        user_id: The user ID who is creating the ticket
        subject: Brief description of the issue
        priority: Ticket priority (low, medium, high)
        category: Ticket category (technical, billing, general)

    Returns:
        The created ticket information
    """
    if user_id not in MOCK_USERS:
        return {"success": False, "error": f"User {user_id} not found"}

    ticket_id = f"ticket-{len(MOCK_TICKETS) + 1:03d}"
    ticket = {
        "id": ticket_id,
        "userId": user_id,
        "subject": subject,
        "status": "open",
        "priority": priority,
        "category": category,
        "createdAt": "2024-01-15",
    }
    MOCK_TICKETS[ticket_id] = ticket
    return {"success": True, "ticket": ticket}


@tool
def update_ticket_status(ticket_id: str, status: str) -> dict:
    """
    Update the status of a support ticket.

    Args:
        ticket_id: The ticket ID to update
        status: New status (open, in_progress, closed)

    Returns:
        Updated ticket information
    """
    ticket = MOCK_TICKETS.get(ticket_id)
    if not ticket:
        return {"success": False, "error": f"Ticket {ticket_id} not found"}

    ticket["status"] = status
    return {"success": True, "ticket": ticket}


@tool
def update_account_status(user_id: str, status: str) -> dict:
    """
    Update a user's account status.

    Args:
        user_id: The user ID to update
        status: New status (active, suspended, inactive)

    Returns:
        Updated user information
    """
    user = MOCK_USERS.get(user_id)
    if not user:
        return {"success": False, "error": f"User {user_id} not found"}

    user["status"] = status
    return {"success": True, "user": user}


@tool
def search_tickets(status: str = None, user_id: str = None) -> dict:
    """
    Search for support tickets by status or user ID.

    Args:
        status: Filter by ticket status (open, closed, in_progress)
        user_id: Filter by user ID

    Returns:
        List of matching tickets
    """
    results = []
    for ticket in MOCK_TICKETS.values():
        if status and ticket["status"] != status:
            continue
        if user_id and ticket["userId"] != user_id:
            continue
        results.append(ticket)

    return {"success": True, "tickets": results, "count": len(results)}


def create_support_agent():
    """
    Create a support agent with customer service tools.

    Returns:
        Configured LangGraph agent ready to handle support queries
    """
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

    tools = [
        get_user_profile,
        create_ticket,
        update_ticket_status,
        update_account_status,
        search_tickets,
    ]

    system_prompt = """You are a helpful customer support agent. You have access to tools to help users with their accounts and support tickets.

When a user asks for help:
1. Use the appropriate tools to gather information
2. Provide clear, friendly responses
3. If you create or update anything, confirm the action"""

    # LangGraph's create_react_agent returns a compiled graph
    # The prompt parameter can be a string (interpreted as system message)
    agent = create_react_agent(llm, tools, prompt=system_prompt)

    return agent
