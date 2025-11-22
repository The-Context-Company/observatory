import net from "net";
import { WebSocketServer } from "ws";
import { tccLocalExporter } from "./runtime";
import { debug } from "../../internal/logger";
import { captureAnonymousEvent } from "../telemetry/posthog";

// these are completely arbitrary ports
const PREFERRED_PORTS = [8081, 3001, 3002, 3003, 3004, 3005, 8000, 8001, 8080];

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => srv.close(() => resolve(true)))
      .listen(port);
  });
}

async function findEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => (port ? resolve(port) : reject(new Error("No port"))));
    });
    srv.on("error", reject);
  });
}

export async function getFreePort() {
  let port: number | null = null;
  for (const p of PREFERRED_PORTS) {
    if (await isPortFree(p)) {
      debug(`Using port ${p} for ws server`);
      port = p;
      break;
    } else {
      debug(`Port ${p} is not free, trying next port`);
    }
  }

  if (!port) {
    const ephemeral = await findEphemeralPort();
    debug(`Using ephemeral port ${ephemeral} for ws server`);
    port = ephemeral;
  }

  return port;
}

export const startWebSocketServer = async () => {
  // instrumentation should(?) never run more than once, but check process just in case
  if (process._tccWss) {
    debug("wss server already found, skipping start");
    return;
  }

  const port = await getFreePort();
  const wss = new WebSocketServer({ port });

  process._tccWss = wss;
  debug(`Saved _tccWss to process`);

  wss.on("connection", (ws) => {
    debug("ws client connected");

    // send initial store
    ws.send(
      JSON.stringify({
        type: "initialStore",
        data: tccLocalExporter.getDataStore(),
      })
    );

    ws.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());
        captureAnonymousEvent(event);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const dataStr = data.toString();
        const truncatedData = dataStr.length > 200 ? dataStr.slice(0, 200) + "..." : dataStr;
        debug(`Failed to parse WebSocket message: ${errorMsg}. Data: ${truncatedData}`);
      }
    });

    // subscribe to new items
    const unsubscribe = tccLocalExporter.subscribe((newItems) => {
      ws.send(JSON.stringify({ type: "newItems", data: newItems }));
    });

    ws.on("close", () => {
      unsubscribe();
    });
  });

  wss.on("error", (error) => {
    debug(`wss error: ${error}`);
    delete process._tccWss;
  });

  wss.on("close", () => {
    debug("wss closed");
    delete process._tccWss;
  });
};
