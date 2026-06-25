import os
import unittest

from contextcompany.config import normalize_base_url


class NormalizeBaseUrlTests(unittest.TestCase):
    def tearDown(self):
        os.environ.pop("TCC_ALLOW_UNSAFE_BASE_URL", None)

    def test_allows_official_origins(self):
        self.assertEqual(
            normalize_base_url("https://api.thecontext.company/"),
            "https://api.thecontext.company",
        )
        self.assertEqual(
            normalize_base_url("https://dev.thecontext.company/v1"),
            "https://dev.thecontext.company/v1",
        )
        self.assertEqual(
            normalize_base_url("https://api.thecontext.company:443/v1"),
            "https://api.thecontext.company/v1",
        )

    def test_allows_localhost(self):
        self.assertEqual(
            normalize_base_url("http://localhost:8787/"),
            "http://localhost:8787",
        )
        self.assertEqual(
            normalize_base_url("http://localhost:80/"),
            "http://localhost",
        )

    def test_rejects_arbitrary_remote_origins_unless_allowed(self):
        with self.assertRaisesRegex(ValueError, "Refusing unsafe"):
            normalize_base_url("https://evil.example")

        os.environ["TCC_ALLOW_UNSAFE_BASE_URL"] = "1"
        self.assertEqual(
            normalize_base_url("https://self-hosted.example/"),
            "https://self-hosted.example",
        )
