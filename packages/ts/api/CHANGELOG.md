# @contextcompany/api

## 1.0.4

### Patch Changes

- 3766d09: Update published package homepage and documentation links to the current The Context Company domains.

## 1.0.3

### Patch Changes

- 5c0068f: Harden feedback submission by validating run IDs before sending feedback and restricting configurable TCC API endpoints to official origins or localhost by default.

## 1.0.2

### Patch Changes

- 6c6bc9c: bundle @contextcompany/api at build time to fix endpoint resolution

## 1.0.1

- Updated README.md

## 1.0.0

- Initial release of core API utilities
- Added `submitFeedback` for user feedback submission
- Added environment variable helpers (`getTCCApiKey`, `getTCCUrl`, `getTCCFeedbackUrl`)
