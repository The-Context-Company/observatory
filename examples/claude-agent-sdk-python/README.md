# Claude Agent SDK Python Example with TCC Instrumentation

A simple example demonstrating the Claude Agent SDK for Python with The Context Company telemetry.

## Features

- **TCC instrumentation** for automatic telemetry collection
- **Interactive conversation** with session tracking
- **Feedback submission** with thumbs up/down
- **Single query mode** for scripting

## Setup

1. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```

4. **Run the example**:
   ```bash
   python main.py
   ```

   Or run a single query:
   ```bash
   python main.py "What is 2 + 2?"
   ```

## Usage

Ask questions naturally:
- "What is the capital of France?"
- "Explain quantum computing in simple terms"
- "Write a haiku about programming"

Give feedback on responses:
- Type `up` for thumbs up 👍
- Type `down` for thumbs down 👎
- Type `exit` to quit

## TCC Instrumentation

The example shows how to:
1. Create an instrumented agent with `instrument_claude_agent()`
2. Pass TCC configuration via `TCCConfig` in each `query()` call
3. Submit user feedback with `submit_feedback()`

Each conversation has a unique `session_id`, and each query has a unique `run_id` for tracking in TCC.

## Debug Mode

Enable verbose TCC debug logging:

```bash
TCC_DEBUG=true python main.py
```

Or pass `debug=True` in the `TCCConfig`:

```python
tcc_config=TCCConfig(run_id="...", debug=True)
```
