"""Instrumentation for the stateful ClaudeSDKClient API."""

from collections import deque
import time
import uuid
from typing import Any, AsyncIterator, Optional

from .claude import (
    TCCConfig, _message_to_dict, _send_to_tcc, _claude_debug,
    _pending_telemetry_tasks,
)
import asyncio


class InstrumentedClaudeClient:
    """Proxy a ClaudeSDKClient, recording one TCC run per response.

    Use query(..., tcc_config=TCCConfig(...)) to attach per-turn metadata.
    Consume receive_response() or receive_messages() normally. Other SDK
    controls, including interrupt(), are delegated to the original client.
    """

    def __init__(self, client: Any, api_key: Optional[str], tcc_url: Optional[str]):
        self._client = client
        self._api_key = api_key
        self._tcc_url = tcc_url
        self._turns: Any = deque()
        self._system_message = None
        self._session_id = str(uuid.uuid4())
        self._cost_total = 0.0
        self._model_totals: dict = {}

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)

    def _new_turn(self, prompt: Any, config: Optional[TCCConfig]) -> dict:
        config = config or TCCConfig()
        metadata = dict(config.metadata or {})
        if config.conversational is not None:
            metadata['tcc.conversational'] = config.conversational
        return {
            'messages': [],
            'run_id': config.run_id or metadata.get('tcc.runId') or str(uuid.uuid4()),
            'session_id': config.session_id or metadata.get('tcc.sessionId') or self._session_id,
            'custom_metadata': metadata,
            'user_prompt': prompt if isinstance(prompt, str) else None,
            'debug': config.debug,
        }

    def _capture_input(self, prompt: Any, turn: dict) -> Any:
        if isinstance(prompt, str) or not hasattr(prompt, '__aiter__'):
            return prompt
        async def capture():
            texts = []
            async for item in prompt:
                content = item.get('message', {}).get('content')
                if isinstance(content, str):
                    texts.append(content)
                elif isinstance(content, list):
                    texts.extend(block['text'] for block in content if block.get('type') == 'text')
                turn['user_prompt'] = '\n'.join(texts) or None
                yield item
        return capture()

    async def connect(self, prompt: Any = None, *, tcc_config: Optional[TCCConfig] = None) -> None:
        turn = self._new_turn(prompt, tcc_config) if prompt is not None else None
        if turn is not None:
            self._turns.append(turn)
        try:
            await self._client.connect(self._capture_input(prompt, turn) if turn is not None else None)
        except BaseException:
            if turn is not None and turn in self._turns:
                self._turns.remove(turn)
            raise

    async def query(self, prompt: Any, session_id: str = 'default', *, tcc_config: Optional[TCCConfig] = None) -> None:
        turn = self._new_turn(prompt, tcc_config)
        self._turns.append(turn)
        try:
            await self._client.query(self._capture_input(prompt, turn), session_id=session_id)
        except BaseException:
            if turn in self._turns:
                self._turns.remove(turn)
            raise

    async def _finish(self, turn: dict) -> None:
        if not turn['messages']:
            return
        payload = {k: v for k, v in turn.items() if k != 'debug'}
        token = _claude_debug.set(turn['debug'])
        try:
            task = asyncio.create_task(asyncio.to_thread(
                _send_to_tcc, **payload, api_key=self._api_key, tcc_url=self._tcc_url,
            ))
            _pending_telemetry_tasks.add(task)
            task.add_done_callback(_pending_telemetry_tasks.discard)
            await asyncio.shield(task)
        finally:
            _claude_debug.reset(token)

    async def _receive(self, stream: AsyncIterator) -> AsyncIterator:
        async for message in stream:
            wire = _message_to_dict(message)
            if wire.get('type') == 'system' and wire.get('subtype') == 'init':
                self._system_message = dict(wire)
            # A client may already have been connected with a prompt before wrapping.
            if not self._turns:
                self._turns.append(self._new_turn(None, None))
            turn = self._turns[0]
            stamp = int(time.time() * 1000)
            envelope = {'runId': turn['run_id'], 'sessionId': turn['session_id']}
            if not turn['messages'] and self._system_message and wire.get('subtype') != 'init':
                # The SDK emits init only once per connection. Each exported run
                # needs the session's model/configuration, with this turn's clock.
                turn['messages'].append({**self._system_message, 'receivedAtMs': stamp, 'tccMetadata': envelope})
            wire.update(receivedAtMs=stamp, tccMetadata=envelope)
            turn['messages'].append(wire)
            if wire.get('type') == 'conversation_reset':
                self._cost_total = 0.0
                self._model_totals = {}
            if wire.get('type') == 'result':
                # SDK cost/model usage is cumulative within a connection;
                # exported TCC runs must contain only this turn's delta.
                total = wire.get('total_cost_usd')
                reset = total is not None and total < self._cost_total
                if total is not None:
                    wire['total_cost_usd'] = total if reset else total - self._cost_total
                    self._cost_total = total
                current = wire.get('modelUsage', {})
                delta = {}
                cumulative_keys = ('inputTokens', 'outputTokens', 'cacheReadInputTokens',
                                   'cacheCreationInputTokens', 'webSearchRequests', 'costUSD', 'thinkingTokens')
                for model, values in current.items():
                    previous = {} if reset else self._model_totals.get(model, {})
                    delta[model] = dict(values)
                    for key in cumulative_keys:
                        if key in values:
                            value = values[key]
                            old = previous.get(key, 0)
                            delta[model][key] = value - old if value >= old else value
                if current:
                    wire['modelUsage'] = delta
                    self._model_totals = {model: dict(values) for model, values in current.items()}
                self._turns.popleft()
                await self._finish(turn)
            yield message

    async def receive_response(self) -> AsyncIterator:
        async for message in self._receive(self._client.receive_response()):
            yield message

    async def receive_messages(self) -> AsyncIterator:
        async for message in self._receive(self._client.receive_messages()):
            yield message

    async def disconnect(self) -> None:
        try:
            await self._client.disconnect()
        finally:
            while self._turns:
                await self._finish(self._turns.popleft())
            self._system_message = None
            self._cost_total = 0.0
            self._model_totals = {}

    async def __aenter__(self) -> 'InstrumentedClaudeClient':
        await self._client.__aenter__()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> Any:
        try:
            return await self._client.__aexit__(exc_type, exc_val, exc_tb)
        finally:
            while self._turns:
                await self._finish(self._turns.popleft())
            self._system_message = None
            self._cost_total = 0.0
            self._model_totals = {}


def instrument_claude_client(client: Any, *, api_key: Optional[str] = None, tcc_url: Optional[str] = None) -> InstrumentedClaudeClient:
    """Wrap an existing ClaudeSDKClient while preserving its control methods."""
    return InstrumentedClaudeClient(client, api_key, tcc_url)
