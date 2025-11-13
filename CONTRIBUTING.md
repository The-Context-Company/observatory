# <img src="./.github/assets/tcc-logo.svg" width="70" align="center" /> Contributing to Observatory

Thank you for your interest in contributing to Observatory! We're excited to have you here. Observatory is an AI agent observability platform.

This document provides guidelines and instructions for contributing to the project. By participating, you agree to uphold our community standards and make this a welcoming environment for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Commit Message Conventions](#commit-message-conventions)
- [Review Process](#review-process)
- [Community](#community)
- [Questions?](#questions)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful, considerate, and collaborative. Harassment and abusive behavior will not be tolerated.

## Ways to Contribute

There are many ways to contribute to Observatory:

- **Report bugs** - Found a bug? Open an issue with detailed reproduction steps
- **Suggest features** - Have an idea? We'd love to hear it!
- **Improve documentation** - Help make our docs clearer and more comprehensive
- **Write code** - Submit pull requests for bug fixes, features, or improvements
- **Answer questions** - Help other users in issues and discussions
- **Share feedback** - Let us know how we can improve the developer experience

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18.0.0 or higher
- **pnpm** v9+ (install with `npm install -g pnpm`)
- **Git**

### Initial Setup

1. **Fork the repository** to your GitHub account

2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/observatory.git
   cd observatory
   ```

3. **Add the upstream remote**:

   ```bash
   git remote add upstream https://github.com/The-Context-Company/observatory.git
   ```

4. **Install dependencies**:

   ```bash
   pnpm install
   ```

### Keeping Your Fork Updated

Regularly sync your fork with the upstream repository:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## Project Structure

Observatory is a **pnpm monorepo** with the following structure:

```
observatory/
├── .changeset/              # Changeset configuration for versioning
├── packages/                # Published npm packages
│   ├── otel/               # @contextcompany/otel - OpenTelemetry integration
│   │   ├── src/            # Source code
│   │   │   ├── index.ts                    # Main exports
│   │   │   ├── TCCSpanProcessor.ts         # Core span processor
│   │   │   ├── exporters/                  # OTLP exporters
│   │   │   └── nextjs/                     # Next.js integration
│   │   ├── package.json
│   │   └── tsup.config.ts  # Build configuration
│   └── widget/             # @contextcompany/widget - Browser visualization
│       ├── src/            # Source code
│       │   ├── index.ts                    # Widget initialization
│       │   ├── widget.tsx                  # Main Preact component
│       │   ├── components/                 # UI components
│       │   ├── hooks/                      # Preact hooks
│       │   └── utils/                      # Utility functions
│       ├── package.json
│       └── tsup.config.ts
├── examples/                # Example applications (not published)
│   └── nextjs-widget/      # Next.js demo app
└── pnpm-workspace.yaml     # Workspace configuration
```

### Package Descriptions

#### `@contextcompany/otel`

OpenTelemetry instrumentation layer for the Vercel AI SDK. Provides span processors, exporters, and Next.js integration for collecting telemetry data in both local and cloud modes.

**Key files:**

- `src/TCCSpanProcessor.ts` - Filters and processes AI SDK spans
- `src/nextjs/instrumentation.ts` - Main API (`registerOTelTCC()`)
- `src/nextjs/local/` - Local mode WebSocket server
- `src/exporters/` - Custom OTLP exporters

#### `@contextcompany/widget`

Browser-based visualization widget for real-time AI SDK observability. Built with Preact for minimal bundle size and uses Shadow DOM for style isolation.

**Key files:**

- `src/widget.tsx` - Main widget UI
- `src/components/` - Reusable UI components
- `src/state.ts` - Global state management with Preact signals

#### `examples/nextjs-widget`

Demonstration Next.js application showing real-world usage. Not published to npm. Use this to test your changes in a realistic environment.

## Development Workflow

### Working on a Package

1. **Create a feature branch**:

   ```bash
   git checkout -b your-name/your-feature-name
   ```

2. **Navigate to the package** you want to work on:

   ```bash
   cd packages/<package-name>
   ```

### Understanding Development Commands

Each package supports two development modes:

#### `pnpm dev`

- **Watch mode only** - Automatically rebuilds when you save files
- Output goes to the `dist/` folder
- **No local server included**
- **When to use:** Testing changes via the example app in `examples/nextjs-widget`
- Faster and minimal overhead

#### `pnpm dev:all`

- **Watch mode + local HTTP server**
- Automatically rebuilds AND serves the built files
- Each package may serve on a different port (check package-specific documentation)
- **When to use:** Need to directly test built files in a browser without the example app
- Ideal for developing browser-loadable scripts or debugging package outputs directly

**Example workflow:**

```bash
# Working on a package with testing via example app
cd packages/otel
pnpm dev                    # Terminal 1: Watch and rebuild

cd examples/nextjs-widget
pnpm dev                    # Terminal 2: Run consumer app
```

Or:

```bash
# Working on a package with direct browser testing
cd packages/widget
pnpm dev:all               # Watches, rebuilds, and serves on localhost
```

### Testing Your Changes

You can test your changes in the example app:

```bash
cd examples/nextjs-widget
pnpm dev  # Starts Next.js on http://localhost:3000
```

The example app uses the local packages via workspace dependencies, so your changes will be reflected after rebuilding.

### Building

Build individual packages:

```bash
cd packages/otel
pnpm build
```

Build all packages from the root:

```bash
pnpm build
```

**Note:** The widget package requires CSS compilation. Run `pnpm build:css` first or use `pnpm dev` for watch mode.

### Adding Dependencies

When adding dependencies to a package:

1. Navigate to the package directory
2. Add the dependency:

   ```bash
   pnpm add <package-name>
   # or for dev dependencies
   pnpm add -D <package-name>
   ```

3. Rebuild the package to ensure everything works

For cross-package dependencies (e.g., using `@contextcompany/otel` in an example), use workspace protocol:

```json
{
  "dependencies": {
    "@contextcompany/otel": "workspace:*"
  }
}
```

## Testing

Currently, Observatory does not have a comprehensive test suite (contributions welcome!). Please manually test your changes:

1. **Build the packages** you modified
2. **Run the example app** to verify functionality
3. **Test both local and cloud modes** if applicable
4. **Check for console errors** and warnings
5. **Test in different browsers** if working on the widget

If you're adding a new feature, consider adding test cases or documenting test procedures in your PR.

## Submitting Changes

### Before Submitting

1. **Ensure your code builds** without errors
2. **Test your changes** thoroughly
3. **Update documentation** if needed
4. **Add a changeset** (see below)

### Creating a Changeset

Observatory uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

When you make changes that should be released (bug fixes, features, breaking changes), add a changeset:

```bash
pnpm changeset
```

Follow the prompts:

1. Select which packages are affected
2. Choose the version bump type:
   - **patch** - Bug fixes, minor improvements
   - **minor** - New features, backwards-compatible
   - **major** - Breaking changes
3. Describe the changes in a user-friendly way

**Note:** Changes to the `examples/` directory don't require changesets as they aren't published.

### Opening a Pull Request

1. **Push your branch** to your fork:

2. **Open a Pull Request** on GitHub from your fork to `The-Context-Company/observatory:main`

3. **Fill out the PR template** with:
   - Clear description of changes
   - Motivation and context
   - How you tested the changes
   - Screenshots/videos if applicable (especially for widget changes)
   - Any breaking changes or migration steps

4. **Use a descriptive PR title** following the [Commit Message Conventions](#commit-message-conventions)

5. **Link related issues if applicable** using keywords like "Fixes #123" or "Closes #456"

### PR Review Process

- A maintainer will review your PR and may request changes
- Address feedback by pushing additional commits to your branch
- Once approved, a maintainer will merge your PR
- Your changes will be included in the next release

## Commit Message Conventions

While not strictly enforced, we recommend following conventional commit format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style/formatting
- `refactor` - Code refactoring
- `test` - Adding/updating tests
- `chore` - Maintenance tasks

**Examples:**

```
feat(otel): add support for custom span attributes
fix(widget): resolve drag-and-drop positioning bug
docs: update installation instructions
chore: upgrade dependencies
```

## Review Process

### What We Look For

- **Correctness** - Does the code work as intended?
- **Code quality** - Is it readable, maintainable, and well-structured?
- **Performance** - Are there any performance concerns?
- **Security** - Are there any security vulnerabilities?
- **Testing** - Has it been adequately tested?
- **Documentation** - Are changes documented appropriately?

### Review Timeline

- We aim to provide initial feedback within **3-5 business days**
- Complex changes may take longer
- Feel free to ping maintainers if your PR hasn't been reviewed after a week

### Addressing Feedback

- Be open to constructive criticism
- Ask questions if feedback is unclear
- Push additional commits to address comments
- Mark conversations as resolved once addressed

## Community

### Getting Help

- **GitHub Issues** - For bug reports and feature requests
- **GitHub Discussions** - For questions and community discussions
- **README** - Check the main README for usage documentation

### Recognition

All contributors will be recognized in our release notes and commit history. Thank you for making Observatory better!

---

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion on GitHub
- Comment on an existing issue
- Reach out to the maintainers

**Happy contributing!** We appreciate your time and effort in making Observatory better for everyone.
