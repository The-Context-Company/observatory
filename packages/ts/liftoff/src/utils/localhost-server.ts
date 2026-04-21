import { createServer, type Server } from "node:http";
import { URL } from "node:url";

/** Result of a successful OAuth callback */
export interface CallbackResult {
  code: string;
  state: string;
}

/** Default timeout for waiting on OAuth callback (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

const SUCCESS_HTML = `<html><body><h1>Authentication successful!</h1><p>You can close this tab and return to your terminal.</p></body></html>`;

const FAILURE_HTML = `<html><body><h1>Authentication failed</h1><p>The callback was missing a code or the state didn't match. Return to your terminal and try again.</p></body></html>`;

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
