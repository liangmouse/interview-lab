import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";

const VOLC_REALTIME_URL =
  "wss://openspeech.bytedance.com/api/v3/realtime/dialogue";
const VOLC_RESOURCE_ID = "volc.speech.dialog";
// Fixed per Volcengine doc section 2.1
const VOLC_APP_KEY = "PlgvMymc7f3tQnJ6";

const REQUIRED_VOICE_REALTIME_ENV = [
  "VOLC_REALTIME_BROWSER_API_KEY",
  "VOLCENGINE_STT_APP_ID",
  "VOLCENGINE_STT_ACCESS_TOKEN",
] as const;

type AuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 503; reason: string };

type GatewayDiagnosticEvent = {
  type: "gateway_diagnostic";
  event:
    | "browser_connected"
    | "upstream_upgrade"
    | "upstream_open"
    | "upstream_unexpected_response"
    | "upstream_error"
    | "upstream_closed"
    | "browser_closed";
  connectId: string;
  at: string;
  detail?: Record<string, unknown>;
};

type ProxyCounters = {
  browserFrames: number;
  browserBytes: number;
  upstreamFrames: number;
  upstreamBytes: number;
  pendingFrames: number;
  pendingBytes: number;
};

function nowIso() {
  return new Date().toISOString();
}

function createCounters(): ProxyCounters {
  return {
    browserFrames: 0,
    browserBytes: 0,
    upstreamFrames: 0,
    upstreamBytes: 0,
    pendingFrames: 0,
    pendingBytes: 0,
  };
}

function asBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.concat(data);
}

function safeCloseReason(reason: string) {
  return Buffer.byteLength(reason) > 120 ? reason.slice(0, 60) : reason;
}

export function getVoiceRealtimeConfigStatus(
  env: NodeJS.ProcessEnv = process.env,
) {
  const missingEnv = REQUIRED_VOICE_REALTIME_ENV.filter((key) => !env[key]);
  return {
    configured: missingEnv.length === 0,
    missingEnv,
  };
}

export function createVoiceRealtimeProxy() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (browserWs, req) => {
    const connectId = randomUUID();
    const startedAt = Date.now();
    const counters = createCounters();
    const appId = process.env.VOLCENGINE_STT_APP_ID;
    const accessToken = process.env.VOLCENGINE_STT_ACCESS_TOKEN;

    function log(
      level: "log" | "warn" | "error",
      event: string,
      detail: Record<string, unknown> = {},
    ) {
      const elapsedMs = Date.now() - startedAt;
      console[level]("[voice-proxy]", {
        connectId,
        event,
        elapsedMs,
        ...detail,
      });
    }

    function sendDiagnostic(
      event: GatewayDiagnosticEvent["event"],
      detail?: Record<string, unknown>,
    ) {
      const payload: GatewayDiagnosticEvent = {
        type: "gateway_diagnostic",
        event,
        connectId,
        at: nowIso(),
        ...(detail ? { detail } : {}),
      };
      if (browserWs.readyState === browserWs.OPEN) {
        browserWs.send(JSON.stringify(payload));
      }
    }

    if (!appId || !accessToken) {
      const status = getVoiceRealtimeConfigStatus();
      log("error", "server_misconfigured", {
        missingEnv: status.missingEnv,
      });
      browserWs.close(1011, "server_misconfigured");
      return;
    }

    const upstream = new WebSocket(VOLC_REALTIME_URL, {
      headers: {
        "X-Api-App-ID": appId,
        "X-Api-Access-Key": accessToken,
        "X-Api-Resource-Id": VOLC_RESOURCE_ID,
        "X-Api-App-Key": VOLC_APP_KEY,
        "X-Api-Connect-Id": connectId,
      },
      // Accept large binary frames (audio)
      maxPayload: 1024 * 1024 * 4,
    });

    log("log", "browser_connected", {
      ip: req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
    sendDiagnostic("browser_connected", {
      ip: req.socket.remoteAddress,
    });

    let upstreamOpen = false;
    const pendingFromBrowser: Array<Buffer> = [];

    upstream.on("upgrade", (res) => {
      const logid = res.headers["x-tt-logid"];
      log("log", "upstream_upgrade", {
        statusCode: res.statusCode,
        logid,
      });
      sendDiagnostic("upstream_upgrade", {
        statusCode: res.statusCode,
        logid,
      });
    });

    upstream.on("open", () => {
      upstreamOpen = true;
      log("log", "upstream_open", {
        pendingFrames: pendingFromBrowser.length,
        pendingBytes: counters.pendingBytes,
      });
      sendDiagnostic("upstream_open", {
        pendingFrames: pendingFromBrowser.length,
        pendingBytes: counters.pendingBytes,
      });
      for (const msg of pendingFromBrowser) upstream.send(msg);
      pendingFromBrowser.length = 0;
      counters.pendingFrames = 0;
      counters.pendingBytes = 0;
    });

    upstream.on("message", (data) => {
      const buf = asBuffer(data);
      counters.upstreamFrames += 1;
      counters.upstreamBytes += buf.byteLength;
      if (browserWs.readyState === browserWs.OPEN) {
        browserWs.send(buf, { binary: true });
      }
    });

    upstream.on("unexpected-response", (_req, res) => {
      const logid = res.headers["x-tt-logid"];
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => {
        if (Buffer.concat(chunks).byteLength < 4096) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      });
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8").slice(0, 1000);
        log("error", "upstream_unexpected_response", {
          statusCode: res.statusCode,
          logid,
          body,
        });
      });
      sendDiagnostic("upstream_unexpected_response", {
        statusCode: res.statusCode,
        logid,
      });
      if (browserWs.readyState === browserWs.OPEN) {
        browserWs.close(1011, `upstream_http_${res.statusCode}`);
      }
    });

    upstream.on("error", (err) => {
      log("error", "upstream_error", { message: err.message });
      sendDiagnostic("upstream_error", { message: err.message });
      if (browserWs.readyState === browserWs.OPEN) {
        browserWs.close(1011, "upstream_error");
      }
    });

    upstream.on("close", (code, reason) => {
      const reasonText = reason.toString();
      log("warn", "upstream_closed", {
        code,
        reason: reasonText,
        counters,
      });
      sendDiagnostic("upstream_closed", {
        code,
        reason: reasonText,
        counters,
      });
      if (browserWs.readyState === browserWs.OPEN) {
        const closeCode = code === 1000 ? 1000 : 1011;
        browserWs.close(
          closeCode,
          safeCloseReason(`upstream_closed_${code || "unknown"}`),
        );
      }
    });

    browserWs.on("message", (data, isBinary) => {
      if (!isBinary) return;
      const buf = asBuffer(data);
      counters.browserFrames += 1;
      counters.browserBytes += buf.byteLength;
      if (!upstreamOpen) {
        pendingFromBrowser.push(buf);
        counters.pendingFrames += 1;
        counters.pendingBytes += buf.byteLength;
        return;
      }
      upstream.send(buf);
    });

    browserWs.on("close", (code, reason) => {
      log("log", "browser_closed", {
        code,
        reason: reason.toString(),
        counters,
      });
      if (
        upstream.readyState === upstream.OPEN ||
        upstream.readyState === upstream.CONNECTING
      ) {
        upstream.close();
      }
    });

    browserWs.on("error", (err) => {
      log("error", "browser_error", { message: err.message });
    });
  });

  function authenticate(req: IncomingMessage): AuthResult {
    const expected = process.env.VOLC_REALTIME_BROWSER_API_KEY;
    if (!expected) {
      return {
        ok: false,
        status: 503,
        reason: "missing_browser_api_key",
      };
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const provided =
      url.searchParams.get("token") ??
      req.headers["x-browser-token"]?.toString();
    if (!provided) {
      return { ok: false, status: 401, reason: "missing_browser_token" };
    }
    if (provided !== expected) {
      return { ok: false, status: 403, reason: "invalid_browser_token" };
    }
    return { ok: true };
  }

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const auth = authenticate(req);
    if (!auth.ok) {
      console.warn(
        `[voice-proxy] reject upgrade status=${auth.status} reason=${auth.reason} ip=${req.socket.remoteAddress}`,
      );
      socket.write(
        `HTTP/1.1 ${auth.status} ${auth.reason}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${auth.reason}\n`,
      );
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }

  return { handleUpgrade };
}
