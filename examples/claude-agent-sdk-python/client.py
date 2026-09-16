"""Stateful conversation example. Run: python client.py"""
import asyncio
import os

from dotenv import load_dotenv
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, ResultMessage
from contextcompany.claude import instrument_claude_client, TCCConfig

load_dotenv()


async def main():
    options = ClaudeAgentOptions(model=os.getenv("CLAUDE_MODEL", "haiku"), tools=[], setting_sources=[])
    async with instrument_claude_client(ClaudeSDKClient(options=options)) as client:
        for prompt in ["Remember the codeword ORCHID. Reply OK.", "What is the codeword?"]:
            await client.query(prompt, tcc_config=TCCConfig(conversational=True))
            async for message in client.receive_response():
                if isinstance(message, ResultMessage):
                    print(message.result or message.subtype)


if __name__ == "__main__":
    asyncio.run(main())
