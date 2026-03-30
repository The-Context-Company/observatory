# @contextcompany/claude

## 1.0.1

### Patch Changes

- 6c6bc9c: bundle @contextcompany/api at build time to fix endpoint resolution

## 1.0.0

- Initial stable release
- Refactored to use @contextcompany/api for shared utilities
- Added `instrumentClaudeAgent` for transparent telemetry collection
- Added `submitFeedback` API for user feedback
- Support for custom metadata, runId, and sessionId
- Improved error messages
