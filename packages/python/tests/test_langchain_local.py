from unittest.mock import Mock

import pytest

from contextcompany.langchain import instrument_langchain
from contextcompany.langchain import base


def test_instrument_langchain_local_mode_does_not_require_api_key(monkeypatch):
    setup = Mock(return_value="provider")
    instrumentor = Mock()
    monkeypatch.delenv("TCC_API_KEY", raising=False)
    monkeypatch.delenv("TCC_LOCAL_OTLP_ENDPOINT", raising=False)
    monkeypatch.setattr("contextcompany.langchain.setup_instrumentation", setup)
    monkeypatch.setattr(
        "contextcompany.langchain.LangchainInstrumentor",
        Mock(return_value=instrumentor),
    )

    provider = instrument_langchain(local=True)

    assert provider == "provider"
    setup.assert_called_once_with(
        api_key=None,
        endpoint="http://localhost:4318/v1/traces",
    )
    instrumentor.instrument.assert_called_once_with()


def test_instrument_langchain_local_mode_uses_explicit_endpoint(monkeypatch):
    setup = Mock(return_value="provider")
    monkeypatch.setattr("contextcompany.langchain.setup_instrumentation", setup)
    monkeypatch.setattr(
        "contextcompany.langchain.LangchainInstrumentor", Mock(return_value=Mock())
    )

    instrument_langchain(local=True, tcc_url="http://localhost:8787/v1/traces")

    setup.assert_called_once_with(
        api_key=None,
        endpoint="http://localhost:8787/v1/traces",
    )


def test_instrument_langchain_cloud_mode_still_requires_api_key(monkeypatch):
    monkeypatch.delenv("TCC_API_KEY", raising=False)

    with pytest.raises(ValueError, match="TCC API key is required"):
        instrument_langchain()


def test_create_otlp_exporter_omits_authorization_without_api_key(monkeypatch):
    exporter = Mock()
    exporter_cls = Mock(return_value=exporter)
    monkeypatch.setattr(base, "OTLPSpanExporter", exporter_cls)

    result = base.create_otlp_exporter("http://localhost:4318/v1/traces")

    assert result is exporter
    exporter_cls.assert_called_once_with(
        endpoint="http://localhost:4318/v1/traces", headers={}
    )
