# @contextcompany/api

Core API utilities for The Context Company packages.

This package contains shared functionality used by all @contextcompany TypeScript packages.

## Installation

```bash
npm install @contextcompany/api
```

Note: This package is typically installed as a dependency of other @contextcompany packages and doesn't need to be installed directly.

## Usage

```typescript
import { submitFeedback, getTCCApiKey, getTCCUrl } from "@contextcompany/api";

// Submit feedback
await submitFeedback({
  runId: "run-123",
  score: "thumbs_up",
});

// Get configuration
const apiKey = getTCCApiKey();
const url = getTCCUrl();
```
