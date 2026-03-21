"""Claude Agent SDK instrumentation for The Context Company.

Wraps the Claude Agent SDK's query() function to transparently collect
all messages and send them to the TCC backend for observability.

Usage:
    from contextcompany.claude import instrument_claude_agent, TCCConfig
    from contextcompany import submit_feedback

    agent = instrument_claude_agent()

    async for message in agent.query(
        prompt="Hello",
        options=ClaudeAgentOptions(system_prompt="You are helpful."),
        tcc_config=TCCConfig(run_id="my-run", session_id="my-session"),
    ):
        # Process messages normally — they are yielded transparently
        ...

    # Submit feedback on a run
    submit_feedback(run_id="my-run", score="thumbs_up")
"""

from .claude import instrument_claude_agent, TCCConfig, InstrumentedClaudeAgent

__all__ = ["instrument_claude_agent", "TCCConfig", "InstrumentedClaudeAgent"]
