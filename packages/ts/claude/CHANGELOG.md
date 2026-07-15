# @contextcompany/claude

## 1.1.2

### Patch Changes

- 3766d09: Update published package homepage and documentation links to the current The Context Company domains.

## 1.1.1

### Patch Changes

- 5c0068f: Harden feedback submission by validating run IDs before sending feedback and restricting configurable TCC API endpoints to official origins or localhost by default.

## 1.1.0

### Minor Changes

- ae50b7e: Add `conversational` flag to `TCCConfig` to mark a run as user-initiated.

  When set, the value is forwarded as the reserved `tcc.conversational` metadata key on the wire, matching the contract used by other TCC integrations. Existing callers are unaffected; the field is optional.

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
