"""Documentation agent with knowledge base tools."""

from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

# Mock documentation data
DOCS = {
    "getting-started": {
        "id": "getting-started",
        "title": "Getting Started",
        "category": "guides",
        "content": "Welcome to our platform! This guide will help you get started...",
        "keywords": ["intro", "setup", "quickstart"],
    },
    "authentication": {
        "id": "authentication",
        "title": "Authentication",
        "category": "security",
        "content": "Learn how to authenticate API requests using API keys...",
        "keywords": ["auth", "api-key", "security", "login"],
    },
    "api-reference": {
        "id": "api-reference",
        "title": "API Reference",
        "category": "reference",
        "content": "Complete API reference with all endpoints and parameters...",
        "keywords": ["api", "endpoints", "reference", "rest"],
    },
    "webhooks": {
        "id": "webhooks",
        "title": "Webhooks",
        "category": "integrations",
        "content": "Set up webhooks to receive real-time notifications...",
        "keywords": ["webhooks", "callbacks", "events", "notifications"],
    },
    "error-handling": {
        "id": "error-handling",
        "title": "Error Handling",
        "category": "guides",
        "content": "Best practices for handling errors and exceptions...",
        "keywords": ["errors", "exceptions", "debugging", "troubleshooting"],
    },
    "rate-limiting": {
        "id": "rate-limiting",
        "title": "Rate Limiting",
        "category": "reference",
        "content": "Understanding rate limits and how to handle them...",
        "keywords": ["rate-limit", "throttling", "quotas"],
    },
}

CATEGORIES = {
    "guides": ["getting-started", "error-handling"],
    "security": ["authentication"],
    "reference": ["api-reference", "rate-limiting"],
    "integrations": ["webhooks"],
}


@tool
def search_docs(query: str) -> dict:
    """
    Search documentation by keywords or topic.

    Args:
        query: Search query or keywords

    Returns:
        List of matching documentation articles
    """
    query_lower = query.lower()
    results = []

    for doc_id, doc in DOCS.items():
        # Search in title, content, and keywords
        if (
            query_lower in doc["title"].lower()
            or query_lower in doc["content"].lower()
            or any(query_lower in kw for kw in doc["keywords"])
        ):
            results.append(
                {"id": doc["id"], "title": doc["title"], "category": doc["category"]}
            )

    return {"success": True, "results": results, "count": len(results)}


@tool
def get_documentation(doc_id: str) -> dict:
    """
    Retrieve the full content of a documentation article.

    Args:
        doc_id: The unique identifier of the documentation article

    Returns:
        Complete documentation article with title, category, and content
    """
    doc = DOCS.get(doc_id)
    if doc:
        return {"success": True, "document": doc}
    return {"success": False, "error": f"Document {doc_id} not found"}


@tool
def list_categories() -> dict:
    """
    List all available documentation categories.

    Returns:
        List of categories and their document counts
    """
    category_info = []
    for category, doc_ids in CATEGORIES.items():
        category_info.append({"name": category, "count": len(doc_ids)})

    return {"success": True, "categories": category_info}


@tool
def find_related_docs(doc_id: str) -> dict:
    """
    Find documentation articles related to a given article.

    Args:
        doc_id: The ID of the documentation article

    Returns:
        List of related articles in the same category
    """
    doc = DOCS.get(doc_id)
    if not doc:
        return {"success": False, "error": f"Document {doc_id} not found"}

    # Find other docs in same category
    category = doc["category"]
    related = [
        {"id": d_id, "title": DOCS[d_id]["title"]}
        for d_id in CATEGORIES.get(category, [])
        if d_id != doc_id
    ]

    return {"success": True, "related": related, "count": len(related)}


def create_documentation_agent():
    """
    Create a documentation agent with knowledge base tools.

    Returns:
        Configured LangGraph agent ready to help with documentation queries
    """
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

    tools = [
        search_docs,
        get_documentation,
        list_categories,
        find_related_docs,
    ]

    system_prompt = """You are a helpful documentation assistant. You help users find information in the documentation and answer their questions.

When a user asks about documentation:
1. Search for relevant articles
2. Retrieve full documentation when needed
3. Suggest related articles
4. Provide clear, accurate information"""

    agent = create_react_agent(llm, tools, prompt=system_prompt)

    return agent
