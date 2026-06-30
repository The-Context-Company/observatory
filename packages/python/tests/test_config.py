import os
import unittest

from contextcompany.config import assert_safe_url, normalize_base_url


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


class AssertSafeUrlTests(unittest.TestCase):
    def tearDown(self):
        os.environ.pop("TCC_ALLOW_UNSAFE_BASE_URL", None)

    def test_allows_official_and_localhost_endpoints(self):
        for url in (
            "https://api.thecontext.company/v1/traces",
            "https://dev.thecontext.company/v1/custom",
            "http://localhost:8787/v1/feedback",
        ):
            self.assertEqual(assert_safe_url(url), url)

    def test_refuses_arbitrary_origins(self):
        with self.assertRaisesRegex(ValueError, "Refusing to send credentials"):
            assert_safe_url("https://evil.example/v1/traces")

        # A look-alike host that merely embeds the allowed domain must be rejected.
        with self.assertRaisesRegex(ValueError, "Refusing to send credentials"):
            assert_safe_url("https://api.thecontext.company.evil.example/v1/traces")

    def test_raises_on_malformed_url(self):
        with self.assertRaisesRegex(ValueError, "Invalid TCC URL"):
            assert_safe_url("not a url")

    def test_allows_arbitrary_origins_only_with_unsafe_opt_in(self):
        with self.assertRaisesRegex(ValueError, "Refusing to send credentials"):
            assert_safe_url("https://self-hosted.example/v1/traces")

        os.environ["TCC_ALLOW_UNSAFE_BASE_URL"] = "1"
        self.assertEqual(
            assert_safe_url("https://self-hosted.example/v1/traces"),
            "https://self-hosted.example/v1/traces",
        )
