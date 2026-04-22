# @contextcompany/otel

## 1.0.16

### Patch Changes

- e075382: Fix endpoint resolution by bundling `@contextcompany/api` at build time. Prior npm releases (1.0.14, 1.0.15) were compiled against the old 3-arg `getTCCUrl(apiKey, prodUrl, devUrl)` signature but resolved `@contextcompany/api` as an external runtime dependency, which drifted to the new 2-arg `getTCCUrl(path, apiKey)` signature in `@contextcompany/api@1.0.2`. The mismatch produced malformed endpoint URLs (e.g. the API key concatenated onto the base host). This release locks the API code in the dist bundle so the signatures can no longer drift.

## 1.0.15

### Patch Changes

- Published out-of-band (no changeset recorded). Broken: bundle references the old 3-arg `getTCCUrl(apiKey, prodUrl, devUrl)` signature but resolves `@contextcompany/api@^1.0.1` at runtime, which ships the new 2-arg `getTCCUrl(path, apiKey)` signature. Endpoint URLs fail to resolve. Use 1.0.16+.

## 1.0.14

### Patch Changes

- Published out-of-band (no changeset recorded). Same endpoint-resolution bug as 1.0.15. Use 1.0.16+.

## 1.0.13

### Patch Changes

- 4152217: added better error message for production/local conflict

## 1.0.12

### Patch Changes

- Refactored to use @contextcompany/api for shared utilities
- Changed TCC_OTLP_URL to TCC_URL environment variable

## 1.0.11

### Patch Changes

- dependency fixes + row click events

## 1.0.10

### Patch Changes

- - added anonymous telemetry events

## 1.0.9

### Patch Changes

- added auto module for nextjs local mode

## 1.0.8

### Patch Changes

- added support for local and deprecated route.ts
