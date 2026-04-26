import { createServer, type Server } from "node:http";
import { URL } from "node:url";

/** Result of a successful OAuth callback */
export interface CallbackResult {
  code: string;
  state: string;
}

/** Default timeout for waiting on OAuth callback (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Styled HTML served back to the browser after the OAuth redirect.
 *
 * Rebuilt as a direct structural clone of the TCC onboarding step UI
 * (see demo/src/app/onboarding/OnboardingClientPage.tsx +
 * components/onboarding-steps.tsx). The skeleton:
 *
 *   bg-white + pt-[20vh]
 *   └ w-[400px] column, centered, gap-8
 *     ├ ProgressBar (h-1 segments, gap-[3px], bg-orange-500 when filled)
 *     ├ h1: font-semibold text-2xl text-black text-center
 *     ├ p:  -mt-6 text-sm text-stone-500 text-center  (subtitle)
 *     ├ content: mt-8 — here a sharp-edged "selected framework"
 *     │   style block (border-orange-500 text-orange-500) labeling the
 *     │   liftoff session as authenticated
 *     └ nav row: ButtonMono sharp — replaced with the close-tab kbd
 *         hint since there's no CTA to click
 *
 * Orange appears where onboarding puts it: in the filled progress bar
 * and on the selected (active) state block. Geist Mono carries the
 * uppercase status label via the .mono-xs utility.
 */
const PAGE_STYLE = `
  :root {
    --bg: oklch(1 0 0);
    --fg: oklch(0.147 0.004 49.25);
    --muted: oklch(0.553 0.013 58.071);
    --stone-300: oklch(0.87 0.005 60);
    --stone-400: oklch(0.709 0.01 56.259);
    --border: oklch(0.923 0.003 48.717);
    --subtle: oklch(0.97 0.001 106.424);
    --primary: oklch(0.705 0.213 47.604);
    --primary-soft: oklch(0.98 0.02 60);
    --primary-softer: oklch(0.97 0.02 60);
    --primary-dark: oklch(0.5 0.18 35);
    --danger: oklch(0.577 0.245 27.325);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    font-family: "Inter", ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: var(--fg);
    background: var(--bg);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body {
    display: flex;
    justify-content: center;
    min-height: 100vh;
    padding: 20vh 24px 64px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 400px;
    max-width: 100%;
    gap: 32px;
  }

  /* ProgressBar — direct clone of components/onboarding-steps.tsx
     ProgressBar: flex w-full gap-[3px], each segment h-1 flex-1,
     bg-orange-500 when filled, bg-stone-400 when pending. */
  .progress {
    display: flex;
    width: 100%;
    gap: 3px;
  }
  .progress .seg {
    height: 4px;
    flex: 1;
    background: var(--stone-400);
  }
  .progress .seg.filled { background: var(--primary); }
  .progress.err .seg.filled { background: var(--danger); }

  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  h1 {
    font-size: 24px;          /* text-2xl */
    font-weight: 600;         /* font-semibold */
    color: black;
    text-align: center;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .head p {
    font-size: 14px;          /* text-sm */
    color: var(--muted);      /* stone-500 */
    text-align: center;
    line-height: 1.6;
    max-width: 360px;
  }

  /* Selected-state row — clone of the active framework button from
     onboarding-steps.tsx: border-orange-500 text-orange-500, sharp
     edges (no border-radius), h-12, px-3, gap-3, flex items-center. */
  .selected {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 12px;
    background: white;
    border: 1px solid var(--primary);
    color: var(--primary);
  }
  .selected.err { border-color: var(--danger); color: var(--danger); }
  .selected .logo-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
  }
  .selected .logo-slot img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .selected .label {
    font-size: 14px;
    letter-spacing: 0.01em;
    white-space: nowrap;
    text-align: left;
    font-weight: 500;
  }

  /* .mono-xs utility replicated from demo/src/app/globals.css */
  .mono-xs {
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.075em;
    text-transform: uppercase;
    font-weight: 500;
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  .hint kbd {
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 7px;
    border: 1px solid var(--border);
    background: var(--subtle);
    border-radius: 3px;
    color: var(--fg);
    line-height: 1;
  }
`;

const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">`;

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Signed in · The Context Company</title>
  ${FONTS_HEAD}
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <main class="stack" role="main">
    <div class="head">
      <h1>Signed in</h1>
      <p>Return to your terminal to finish setting up liftoff.</p>
    </div>
    <div class="selected">
      <span class="logo-slot">
        <img src="https://www.thecontext.company/logo.svg" alt="" aria-hidden="true" />
      </span>
      <span class="label mono-xs">Liftoff · Authenticated</span>
    </div>
    <span class="hint mono-xs">
      <kbd>⌘</kbd>
      <kbd>W</kbd>
      Close this tab
    </span>
  </main>
</body>
</html>`;

const FAILURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign-in failed · The Context Company</title>
  ${FONTS_HEAD}
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <main class="stack" role="main">
    <div class="head">
      <h1>Sign-in failed</h1>
      <p>The callback was missing a code or the state didn't match. Return to your terminal and re-run liftoff to try again.</p>
    </div>
    <div class="selected err">
      <span class="logo-slot">
        <img src="https://www.thecontext.company/logo.svg" alt="" aria-hidden="true" />
      </span>
      <span class="label mono-xs">Liftoff · Callback Error</span>
    </div>
  </main>
</body>
</html>`;

/**
 * Start a temporary localhost HTTP server to receive an OAuth callback.
 *
 * Binds to 127.0.0.1 with an OS-assigned port. Waits for a GET /callback
 * request containing `code` and `state` query parameters. Validates the
 * state parameter against the expected value. Automatically shuts down
 * after receiving a callback or after the timeout expires.
 *
 * @param expectedState - The PKCE/OAuth state value to validate against
 * @param timeoutMs - How long to wait for the callback (default 30s)
 * @returns Object with the assigned port, a waitForCallback promise, and a close function
 */
export function startCallbackServer(
  expectedState: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{
  port: number;
  waitForCallback: () => Promise<CallbackResult | null>;
  close: () => void;
}> {
  return new Promise((resolveStart) => {
    let closed = false;
    let callbackResolve: (value: CallbackResult | null) => void;
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const callbackPromise = new Promise<CallbackResult | null>((resolve) => {
      callbackResolve = resolve;
    });

    const server: Server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(404);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://127.0.0.1`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const ok = !!code && state === expectedState;

      // Show the user a page that matches what actually happened —
      // serving "Authentication successful!" when we're about to
      // resolve null left the browser and terminal disagreeing, which
      // was painful to debug.
      res.writeHead(ok ? 200 : 400, { "Content-Type": "text/html" });
      res.end(ok ? SUCCESS_HTML : FAILURE_HTML);

      clearTimeout(timeoutHandle);
      callbackResolve(ok ? { code: code!, state: state! } : null);
      closeServer();
    });

    function closeServer(): void {
      if (closed) return;
      closed = true;
      server.close();
    }

    // Set up timeout to resolve null if no callback arrives
    timeoutHandle = setTimeout(() => {
      callbackResolve(null);
      closeServer();
    }, timeoutMs);

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port =
        typeof addr === "object" && addr !== null ? addr.port : 0;

      resolveStart({
        port,
        waitForCallback: () => {
          return callbackPromise;
        },
        close: () => {
          clearTimeout(timeoutHandle);
          callbackResolve(null);
          closeServer();
        },
      });
    });
  });
}
