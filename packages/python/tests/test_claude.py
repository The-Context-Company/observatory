import asyncio
import json
import unittest
from unittest.mock import patch

from claude_agent_sdk._internal.message_parser import parse_message
from contextcompany.claude import instrument_claude_agent, TCCConfig
from contextcompany.claude.claude import _message_to_dict


WIRE = [
    {"type": "system", "subtype": "init", "session_id": "sdk-session", "model": "claude-test"},
    {"type": "assistant", "message": {"id": "msg-1", "model": "claude-test", "content": [
        {"type": "thinking", "thinking": "reasoning", "signature": "sig"},
        {"type": "tool_use", "id": "tool-1", "name": "lookup", "input": {"id": "1"}},
    ], "usage": {"input_tokens": 10, "output_tokens": 5}, "stop_reason": "tool_use"}},
    {"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "tool-1", "content": "Alice", "is_error": False}]}},
    {"type": "assistant", "message": {"id": "msg-2", "model": "claude-test", "content": [{"type": "text", "text": "Alice"}], "usage": {"input_tokens": 15, "output_tokens": 2}}},
    {"type": "result", "subtype": "success", "duration_ms": 100, "duration_api_ms": 90, "is_error": False, "num_turns": 2, "session_id": "sdk-session", "result": "Alice", "total_cost_usd": 0.01, "usage": {"input_tokens": 25, "output_tokens": 7}, "modelUsage": {"claude-test": {"costUSD": 0.01}}, "terminal_reason": "success"},
]


class SerializationTests(unittest.TestCase):
    def test_latest_sdk_wire_round_trip(self):
        for wire in WIRE:
            with self.subTest(type=wire["type"]):
                self.assertEqual(_message_to_dict(parse_message(wire)), wire)

    def test_server_tools_and_stream_events(self):
        wires = [
            {"type": "conversation_reset", "new_conversation_id": "new", "uuid": "event", "session_id": "session"},
            {"type": "assistant", "message": {"model": "test", "content": [
                {"type": "server_tool_use", "id": "s1", "name": "advisor", "input": {}},
                {"type": "advisor_tool_result", "tool_use_id": "s1", "content": {"text": "ok"}},
            ]}},
            {"type": "stream_event", "uuid": "event", "session_id": "session", "event": {"type": "message_start"}},
            {"type": "rate_limit_event", "uuid": "event", "session_id": "session", "rate_limit_info": {"status": "allowed", "resetsAt": 123}},
        ]
        for wire in wires:
            self.assertEqual(_message_to_dict(parse_message(wire)), wire)


class QueryTests(unittest.IsolatedAsyncioTestCase):
    async def test_delivery_is_complete_when_query_finishes(self):
        messages = [parse_message(wire) for wire in WIRE]
        async def query(**kwargs):
            self.assertEqual(kwargs["prompt"], "Who is user 1?")
            for message in messages:
                yield message
        with patch("claude_agent_sdk.query", query), patch("contextcompany.claude.claude.requests.post") as post:
            post.return_value.ok = True
            received = [m async for m in instrument_claude_agent(api_key="dev_test").query(
                prompt="Who is user 1?", tcc_config=TCCConfig(run_id="run", session_id="session", conversational=True))]
            self.assertIs(received[0], messages[0])
            post.assert_called_once()
            payload = post.call_args.kwargs["json"]
            self.assertEqual(payload["customMetadata"], {"tcc.conversational": True})
            self.assertEqual(payload["messages"][1]["message"]["id"], "msg-1")
            json.dumps(payload)

    async def test_close_sends_partial_data(self):
        async def query(**kwargs):
            yield parse_message(WIRE[0])
            yield parse_message(WIRE[1])
        with patch("claude_agent_sdk.query", query), patch("contextcompany.claude.claude.requests.post") as post:
            stream = instrument_claude_agent(api_key="dev_test").query(prompt="hi")
            await anext(stream)
            await stream.aclose()
            post.assert_called_once()
            self.assertEqual(len(post.call_args.kwargs["json"]["messages"]), 1)

    async def test_errors_preserved_and_partial_data_sent(self):
        async def query(**kwargs):
            yield parse_message(WIRE[0])
            raise ValueError("sdk error")
        with patch("claude_agent_sdk.query", query), patch("contextcompany.claude.claude.requests.post") as post:
            with self.assertRaisesRegex(ValueError, "sdk error"):
                async for _ in instrument_claude_agent(api_key="dev_test").query(prompt="hi"):
                    pass
            post.assert_called_once()

    async def test_telemetry_failure_does_not_break_query(self):
        async def query(**kwargs):
            yield parse_message(WIRE[0])
        with patch("claude_agent_sdk.query", query), patch("contextcompany.claude.claude.requests.post", side_effect=RuntimeError("offline")):
            messages = [m async for m in instrument_claude_agent(api_key="dev_test").query(prompt="hi")]
            self.assertEqual(len(messages), 1)


class ClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_multiple_turns_and_controls(self):
        from contextcompany.claude import instrument_claude_client
        from unittest.mock import AsyncMock
        class FakeClient:
            def __init__(self):
                self.count = 0
                self.interrupt = AsyncMock()
                self.disconnect = AsyncMock()
                self.query = AsyncMock()
            async def __aenter__(self): return self
            async def __aexit__(self, *args): await self.disconnect()
            async def receive_response(self):
                self.count += 1
                for wire in WIRE if self.count == 1 else WIRE[1:]:
                    yield parse_message(wire)
            def receive_messages(self): return self.receive_response()
        raw = FakeClient()
        with patch('contextcompany.claude.client._send_to_tcc') as send:
            async with instrument_claude_client(raw) as client:
                for i in range(2):
                    await client.query('hello', tcc_config=TCCConfig(run_id=f'run-{i}'))
                    receiver = client.receive_response() if i == 0 else client.receive_messages()
                    async for _ in receiver: pass
                await client.interrupt()
            raw.interrupt.assert_awaited_once()
            raw.disconnect.assert_awaited_once()
            self.assertEqual(send.call_count, 2)
            first, second = [call.kwargs for call in send.call_args_list]
            self.assertEqual(first['session_id'], second['session_id'])
            self.assertNotEqual(first['run_id'], second['run_id'])
            self.assertEqual(second['messages'][0]['subtype'], 'init')
            self.assertTrue(all(m['tccMetadata']['runId'] == 'run-1' for m in second['messages']))

    async def test_disconnect_flushes_incomplete_turn(self):
        from contextcompany.claude import instrument_claude_client
        from unittest.mock import AsyncMock
        class FakeClient:
            query = AsyncMock()
            disconnect = AsyncMock()
            async def receive_response(self):
                yield parse_message(WIRE[0])
                yield parse_message(WIRE[1])
        with patch('contextcompany.claude.client._send_to_tcc') as send:
            client = instrument_claude_client(FakeClient())
            await client.query('hello')
            stream = client.receive_response()
            await anext(stream)
            await stream.aclose()
            await client.disconnect()
            send.assert_called_once()
            self.assertEqual(len(send.call_args.kwargs['messages']), 1)

    async def test_cost_is_per_turn_not_cumulative(self):
        from contextcompany.claude import instrument_claude_client
        from unittest.mock import AsyncMock
        import copy
        class FakeClient:
            count = 0
            query = AsyncMock()
            async def receive_response(self):
                self.count += 1
                result = copy.deepcopy(WIRE[-1])
                result['total_cost_usd'] = self.count * 0.01
                result['modelUsage']['claude-test']['costUSD'] = self.count * 0.01
                yield parse_message(result)
        with patch('contextcompany.claude.client._send_to_tcc') as send:
            client = instrument_claude_client(FakeClient())
            for i in range(2):
                await client.query('hello')
                async for _ in client.receive_response(): pass
            second = send.call_args.kwargs['messages'][-1]
            self.assertAlmostEqual(second['total_cost_usd'], 0.01)
            self.assertAlmostEqual(second['modelUsage']['claude-test']['costUSD'], 0.01)


class QueryLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_streaming_prompt_and_upstream_close(self):
        closed = []
        async def prompt():
            yield {'type': 'user', 'message': {'content': 'streaming hello'}}
        async def query(**kwargs):
            async for _ in kwargs['prompt']: pass
            try:
                yield parse_message(WIRE[0])
                yield parse_message(WIRE[1])
            finally:
                closed.append(True)
        with patch('claude_agent_sdk.query', query), patch('contextcompany.claude.claude.requests.post') as post:
            stream = instrument_claude_agent(api_key='dev_test').query(prompt=prompt())
            await anext(stream)
            await stream.aclose()
            self.assertEqual(closed, [True])
            self.assertEqual(post.call_args.kwargs['json']['userPrompt'], 'streaming hello')

    async def test_cancellation_keeps_original_error_and_exports_data(self):
        started = asyncio.Event()
        async def query(**kwargs):
            yield parse_message(WIRE[0])
            started.set()
            await asyncio.Event().wait()
        async def consume():
            async for _ in instrument_claude_agent(api_key='dev_test').query(prompt='hi'): pass
        with patch('claude_agent_sdk.query', query), patch('contextcompany.claude.claude.requests.post') as post:
            task = asyncio.create_task(consume())
            await started.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError): await task
            post.assert_called_once()
