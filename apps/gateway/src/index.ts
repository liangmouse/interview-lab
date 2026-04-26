import { createServer } from "node:http";
import {
  createVoiceRealtimeProxy,
  getVoiceRealtimeConfigStatus,
} from "./voice-realtime-proxy";

export { ChannelGateway } from "./channel-gateway";

const PORT = Number(process.env.GATEWAY_PORT ?? 8787);
const HOST = process.env.GATEWAY_HOST ?? "0.0.0.0";

const voiceProxy = createVoiceRealtimeProxy();

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        voiceRealtime: getVoiceRealtimeConfigStatus(),
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/voice/realtime") {
    voiceProxy.handleUpgrade(req, socket, head);
    return;
  }
  socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
  socket.destroy();
});

server.listen(PORT, HOST, () => {
  console.log(`[gateway] listening on ws://${HOST}:${PORT}`);
  console.log(
    `[gateway] voice realtime proxy at ws://${HOST}:${PORT}/voice/realtime`,
  );
});
