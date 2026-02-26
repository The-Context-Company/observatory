# Contributing

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/observatory.git
cd observatory
pnpm install
```

## Project Structure

```
packages/ts/otel/      # @contextcompany/otel
packages/ts/widget/    # @contextcompany/widget
packages/ts/claude/    # @contextcompany/claude
packages/ts/mastra/    # @contextcompany/mastra
packages/ts/custom/    # @contextcompany/custom
packages/ts/api/       # @contextcompany/api
packages/python/       # contextcompany (Python SDK)
examples/              # Example apps
```

## Dev Scripts

- `pnpm dev` — watch mode, rebuilds on save
- `pnpm dev:all` — watch mode + local HTTP server (ports 3001/3002)

## Commit Messages

Format: `type(scope): description`

| Prefix | Version bump |
|--------|-------------|
| `fix(scope):` | patch |
| `perf(scope):` | patch |
| `feat(scope):` | minor |
| `feat(scope)!:` | major |
| `docs:` `chore:` `refactor:` `test:` `ci:` `style:` | no release |

Scopes: `otel`, `widget`, `claude`, `mastra`, `custom`, `api`, `python`

Omit scope for repo-wide changes: `chore: upgrade dependencies`

Examples:

```
fix(widget): prevent popover from rendering off-screen
feat(python): add trace_id field to runs
feat(otel)!: drop Node 16 support
chore: upgrade typescript to 5.9
```

## Releases

Never edit versions manually. CI publishes on merge to `main`:

- **TypeScript** — add a changeset via `pnpm changeset`, CI handles the rest
- **Python** — CI reads commit messages automatically (`fix(python):` → patch, `feat(python):` → minor)

The two pipelines are independent. TS merges don't touch Python and vice versa.

## Submitting

Open a PR with `Allow edits from maintainers` checked.
