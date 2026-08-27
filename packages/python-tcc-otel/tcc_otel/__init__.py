"""Deprecated shim: `tcc-otel` was renamed to `contextcompany`."""

import warnings

warnings.warn(
    "The `tcc-otel` package is deprecated and has been renamed to `contextcompany`. "
    "Install it with `pip install contextcompany` and update your imports. "
    "See https://docs.thecontextcompany.com for current documentation.",
    DeprecationWarning,
    stacklevel=2,
)

from contextcompany import *  # noqa: F401,F403
