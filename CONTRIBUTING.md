# <img src="./.github/assets/tcc-logo.svg" width="70" align="center" /> Contributing to The Context Company

Thank you for taking the time to contribute! We're excited to have you here 🙌

## Table of Contents

- [How to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Commit Message Conventions](#commit-message-conventions)

## How to Contribute

There are many ways to contribute:

- **Report bugs** - Found a bug? Open an issue with detailed reproduction steps
- **Suggest features** - Have an idea? We'd love to hear it!
- **Improve documentation** - Help make our docs clearer and more comprehensive
- **Write code** - Submit pull requests for bug fixes, features, or improvements
- **Answer questions** - Help other users in issues and discussions
- **Share feedback** - Let us know how we can improve developer experience

## Getting Started

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

## Project Structure

Observatory is a **pnpm monorepo** with the following structure:

```
observatory/
├── packages/
│   ├── otel/     # @contextcompany/otel - OpenTelemetry integration
│   └── widget/   # @contextcompany/widget - Preact widget for Local Mode
└── examples/     # Examples of Local Mode
```

### Package Descriptions

#### `@contextcompany/otel`

OpenTelemetry instrumentation layer for the Vercel AI SDK. Provides span processors, exporters, and Next.js integration for collecting telemetry data in both local and cloud modes.

#### `@contextcompany/widget`

Browser-based visualization widget for real-time AI SDK observability. Built with Preact for minimal bundle size and uses Shadow DOM for style isolation.

## Submitting changes

### Development workflow

1. Fork the repo (see [Initial Setup](#initial-setup))
2. Create a feature branch

   ```bash
   git checkout -b your-name/your-feature-name
   ```

3. Commit and push to your changes
4. Open a pull request
   - please check `Allow edits from maintainers` so we can make small tweaks before merging!

### Helper package scripts

Each package supports two development modes:

#### `pnpm dev`

- **Watch mode only** - Automatically rebuilds when you save files
- Output goes to the `dist/` folder

#### `pnpm dev:all`

- **Watch mode + local HTTP server**
- Automatically rebuilds AND serves the built files on port 3001 or 3002
- Lets you use URL imports for testing your local changes outside of the workspace

## Testing Changes Locally

We don't have a comprehensive test suite yet (contributions welcome!). For now, please test your changes locally following the instructions below.

#### Testing `@contextcompany/otel` changes

1. **Ensure the example app uses the workspace version**:
   In your example app's `package.json`, make sure you have:

   ```json
   {
     "dependencies": {
       "@contextcompany/otel": "workspace:*"
     }
   }
   ```

2. **Start the otel dev server** in watch mode:

   ```bash
   cd packages/otel
   pnpm dev
   ```

3. **Run the example app**:

   ```bash
   cd examples/nextjs-widget
   pnpm dev
   ```

4. **Make changes and restart**:
   - After making changes in the otel package, restart the Next.js app
   - The changes should be reflected after the restart

#### Testing `@contextcompany/widget` changes

1. **Start the widget dev server** with hot reloading:

   ```bash
   cd packages/widget
   pnpm dev:all
   ```

   This serves the built widget files on `http://localhost:3001`

2. **Update the example app** to use localhost:
   In `examples/nextjs-widget/app/layout.tsx`, comment out the unpkg script and uncomment the localhost one:

   ```tsx
   {
     /* <script src="https://unpkg.com/@contextcompany/widget/dist/auto.global.js" async /> */
   }
   <script src="http://localhost:3001/auto.global.js" async />;
   ```

3. **Run the example app**:
   ```bash
   cd examples/nextjs-widget
   pnpm dev
   ```

Now you can make changes to the widget package and see them reflected in real-time in the example app!

## Commit Message Conventions

We recommend the conventional commit format:

`<type>(<scope>): <description>`

**Examples:**

```
feat(otel): add support for custom span attributes
fix(widget): resolve drag-and-drop positioning bug
docs: update installation instructions
chore: upgrade dependencies
```

**Happy contributing!** We appreciate your time and effort in making The Context Company better for everyone.
