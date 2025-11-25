import { initWidget } from "./index";
import { log } from "./internal/logger";

async function isWebSocketServer(port: number) {
  return new Promise((resolve) => {
    try {
      // TODO: hide the error code for failed network requests in browser
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.addEventListener("open", () => {
        resolve(true);
      });

      ws.addEventListener("error", () => {
        resolve(false);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

const PREFERRED_PORTS = [8081, 3001, 3002, 3003, 3004, 3005, 8000, 8001, 8080];

const init = async () => {
  const debug = document.currentScript?.getAttribute("data-debug") === "true";

  // TODO: eliminate port scanning and use env vars for the port
  let port: string | undefined;
  for (const p of PREFERRED_PORTS) {
    if (await isWebSocketServer(p)) {
      port = p.toString();
      // window may not be defined so we use log()
      if (debug) log(`Found TCC WebSocket server on port: ${port}`);
      break;
    }
  }

  if (!port)
    throw new Error("TCC: Couldn't find TCC WebSocket server, is it running?");

  if (typeof window !== "undefined") {
    (window as any).TCC_WSS_PORT = port;
    (window as any).TCC_DEBUG = debug;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initWidget();
      });
    } else {
      initWidget();
    }
  }
};

init();

export * from "./index";
