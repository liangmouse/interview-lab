import { EventEmitter } from "node:events";
import "server-only";

const STEP_SESSION_TTL_MS = 15 * 60 * 1000;
const STEP_HISTORY_LIMIT = 200;
const STEP_WS_OPEN = 1;

type RelayEventListener = (message: Record<string, unknown>) => void;

type StepRealtimeSocket = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (
    event: "open" | "message" | "error" | "close",
    listener: (...args: any[]) => void,
  ) => void;
};

type StepRealtimeSocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => StepRealtimeSocket;

type RelaySession = {
  id: string;
  interviewId: string;
  createdAt: number;
  expiresAt: number;
  socket: StepRealtimeSocket;
  emitter: EventEmitter;
  history: Record<string, unknown>[];
  closed: boolean;
};

type GlobalRelayStore = {
  sessions: Map<string, RelaySession>;
};

function getRelayStore(): GlobalRelayStore {
  const globalWithRelay = globalThis as typeof globalThis & {
    __stepfunRealtimeRelayStore?: GlobalRelayStore;
  };

  if (!globalWithRelay.__stepfunRealtimeRelayStore) {
    globalWithRelay.__stepfunRealtimeRelayStore = {
      sessions: new Map<string, RelaySession>(),
    };
  }

  return globalWithRelay.__stepfunRealtimeRelayStore;
}

async function resolveStepRealtimeSocketCtor(): Promise<StepRealtimeSocketCtor> {
  process.env.WS_NO_BUFFER_UTIL = "1";

  const wsModule = (await import("ws")) as {
    default?: StepRealtimeSocketCtor & { WebSocket?: StepRealtimeSocketCtor };
    WebSocket?: StepRealtimeSocketCtor;
  };

  if (wsModule.WebSocket) {
    return wsModule.WebSocket;
  }

  if (typeof wsModule.default === "function") {
    return wsModule.default;
  }

  if (wsModule.default?.WebSocket) {
    return wsModule.default.WebSocket;
  }

  throw new Error("无法加载 StepFun relay 所需的 ws 客户端");
}

function normalizeIncomingMessage(raw: unknown): Record<string, unknown> {
  const asString = (() => {
    if (typeof raw === "string") return raw;
    if (raw instanceof ArrayBuffer) {
      return Buffer.from(raw).toString("utf8");
    }
    if (Array.isArray(raw)) {
      return Buffer.concat(
        raw.map((chunk) =>
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"),
        ),
      ).toString("utf8");
    }
    if (Buffer.isBuffer(raw)) {
      return raw.toString("utf8");
    }
    return String(raw);
  })();

  try {
    return JSON.parse(asString) as Record<string, unknown>;
  } catch {
    return {
      type: "relay.parse_error",
      raw: asString,
    };
  }
}

function pushRelayEvent(
  session: RelaySession,
  message: Record<string, unknown>,
) {
  session.history.push(message);
  if (session.history.length > STEP_HISTORY_LIMIT) {
    session.history.shift();
  }
  session.emitter.emit("message", message);
}

function scheduleSessionGarbageCollection(sessionId: string) {
  setTimeout(() => {
    const store = getRelayStore();
    const session = store.sessions.get(sessionId);
    if (!session) return;
    if (session.closed || session.expiresAt <= Date.now()) {
      store.sessions.delete(sessionId);
    }
  }, STEP_SESSION_TTL_MS);
}

export async function createStepfunRelaySession(options: {
  interviewId: string;
  wsUrl: string;
  apiKey: string;
}): Promise<{ sessionId: string; expiresAt: string }> {
  const WebSocketCtor = await resolveStepRealtimeSocketCtor();
  const sessionId = crypto.randomUUID();
  const socket = new WebSocketCtor(options.wsUrl, [], {
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
    },
  });

  const session: RelaySession = {
    id: sessionId,
    interviewId: options.interviewId,
    createdAt: Date.now(),
    expiresAt: Date.now() + STEP_SESSION_TTL_MS,
    socket,
    emitter: new EventEmitter(),
    history: [],
    closed: false,
  };

  const store = getRelayStore();
  store.sessions.set(sessionId, session);
  scheduleSessionGarbageCollection(sessionId);

  socket.on("message", (raw: unknown) => {
    const message = normalizeIncomingMessage(raw);
    pushRelayEvent(session, message);
  });

  socket.on("error", (error: Error) => {
    pushRelayEvent(session, {
      type: "relay.error",
      error: {
        message: error.message,
      },
    });
  });

  socket.on("close", (code: number, reason: Buffer) => {
    session.closed = true;
    pushRelayEvent(session, {
      type: "relay.closed",
      code,
      reason: reason?.toString("utf8") || "",
    });
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("连接 StepFun Realtime 超时"));
    }, 10_000);

    socket.on("open", () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return {
    sessionId,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

export function subscribeToStepfunRelaySession(
  sessionId: string,
  listener: RelayEventListener,
) {
  const session = getRelayStore().sessions.get(sessionId);
  if (!session) {
    throw new Error("找不到 StepFun 实时会话");
  }

  session.history.forEach((message) => listener(message));
  session.emitter.on("message", listener);

  return () => {
    session.emitter.off("message", listener);
  };
}

export function sendStepfunRelayEvent(
  sessionId: string,
  event: Record<string, unknown>,
) {
  const session = getRelayStore().sessions.get(sessionId);
  if (!session) {
    throw new Error("找不到 StepFun 实时会话");
  }
  if (session.closed || session.socket.readyState !== STEP_WS_OPEN) {
    throw new Error("StepFun 实时会话已断开");
  }
  session.socket.send(JSON.stringify(event));
}

export function closeStepfunRelaySession(sessionId: string) {
  const store = getRelayStore();
  const session = store.sessions.get(sessionId);
  if (!session) return;

  try {
    if (!session.closed) {
      session.socket.close(1000, "client_disconnect");
    }
  } finally {
    session.closed = true;
    store.sessions.delete(sessionId);
  }
}

export function ensureStepfunRelaySession(sessionId: string) {
  const session = getRelayStore().sessions.get(sessionId);
  if (!session) {
    throw new Error("找不到 StepFun 实时会话");
  }
  if (session.expiresAt <= Date.now()) {
    closeStepfunRelaySession(sessionId);
    throw new Error("StepFun 实时会话已过期");
  }
  return session;
}
