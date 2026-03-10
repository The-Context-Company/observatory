"""Context propagation for threading run_id through nested Agno calls."""

from contextvars import ContextVar, Token
from typing import Optional

_current_run_id: ContextVar[Optional[str]] = ContextVar(
    "tcc_agno_run_id", default=None
)


def get_current_run_id() -> Optional[str]:
    return _current_run_id.get()


def set_current_run_id(run_id: Optional[str]) -> Token[Optional[str]]:
    return _current_run_id.set(run_id)


def reset_current_run_id(token: Token[Optional[str]]) -> None:
    _current_run_id.reset(token)
