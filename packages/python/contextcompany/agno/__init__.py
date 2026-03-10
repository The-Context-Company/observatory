"""Agno framework instrumentation for The Context Company.

Automatically captures Run, Step, and ToolCall data from Agno agents.

Usage:
    from contextcompany.agno import instrument_agno

    instrument_agno()

    # Your Agno code is now automatically traced
    from agno.agent import Agent
    from agno.models.openai import OpenAIChat

    agent = Agent(model=OpenAIChat(id="gpt-4o"), tools=[...])
    response = agent.run("What is the weather in SF?")
"""

from typing import Optional


def instrument_agno(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> None:
    """Instrument the Agno framework for automatic observability.

    Patches Agent, Team, Model, and FunctionCall classes to capture
    Run/Step/ToolCall data and send it to The Context Company.

    Call this once at startup, before creating any Agno Agent or Team
    instances.

    Args:
        api_key: TCC API key. Falls back to the ``TCC_API_KEY`` env var.
        tcc_url: Override the TCC endpoint URL. Falls back to ``TCC_URL``
                 env var, then auto-selects prod/dev based on the key prefix.
    """
    try:
        import agno  # noqa: F401
    except ImportError:
        raise ImportError(
            "The 'agno' package is required for Agno instrumentation. "
            "Install it with:  pip install contextcompany[agno]"
        )

    try:
        import wrapt  # noqa: F401
    except ImportError:
        raise ImportError(
            "The 'wrapt' package is required for Agno instrumentation. "
            "Install it with:  pip install contextcompany[agno]"
        )

    from .._utils import _debug

    _debug("Initializing Agno instrumentation")

    from ._wrappers import patch_all

    patch_all(api_key=api_key, tcc_url=tcc_url)

    _debug("Agno instrumentation initialized")


__all__ = ["instrument_agno"]
