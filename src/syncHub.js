// src/syncHub.js
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.SYNC_PORT || 3000;

// Optional shared secret for webhooks (set in Railway later if you want)
const WEBHOOK_SECRET = process.env.NEXUS_WEBHOOK_SECRET || null;

let wss = null;

/**
 * Broadcast a JSON-able payload to all connected WebSocket clients
 */
function broadcastUpdate(payload) {
  if (!wss) return;

  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

/**
 * Start the combined HTTP (webhook) + WebSocket server.
 * Only call this once.
 */
export function startSyncHub() {
  if (wss) {
    console.log("♻️ Sync hub already running, skipping second start.");
    return { broadcastUpdate };
  }

  const app = express();
  app.use(express.json());

  // Simple health check
  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "Event Nexus Sync Hub",
      version: "v1",
    });
  });

  // Simple auth helper for webhooks
  function checkWebhookAuth(req, res, next) {
    if (!WEBHOOK_SECRET) return next(); // no secret configured = allow all (dev mode)

    const header = req.headers["x-webhook-secret"];
    if (!header || header !== WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    next();
  }

  // -----------------------------
  // 1) Webhook: app → bot (event)
  // -----------------------------
  // POST http://<bot-host>:3000/webhook/events
  // Body example:
  // {
  //   "source": "app",
  //   "action": "created" | "updated" | "deleted",
  //   "event": {
  //     "id": "...",
  //     "title": "...",
  //     "time": "...",
  //     "description": "...",
  //     "maxPlayers": 30,
  //     "imageUrl": "...",
  //     "discordChannelId": "123...",
  //     "discordMessageId": "optional"
  //   }
  // }
  app.post("/webhook/events", checkWebhookAuth, async (req, res) => {
    const payload = req.body || {};

    console.log("📥 Webhook /events from app:", JSON.stringify(payload, null, 2));

    // Broadcast to any listening WebSocket clients (front-end, dashboards, etc.)
    broadcastUpdate({
      type: "app_event",
      data: payload,
      ts: Date.now(),
    });

    // You *can* later add logic here to:
    // - Create / edit a Discord embed
    // - Mirror event into a specific channel
    // For now we just acknowledge + broadcast.
    return res.json({ ok: true });
  });

  // -----------------------------------
  // 2) Webhook: app → bot (RSVP update)
  // -----------------------------------
  // POST http://<bot-host>:3000/webhook/rsvp
  // Body example:
  // {
  //   "eventId": "...",
  //   "userId": "...",
  //   "status": "vip" | "yes" | "maybe" | "no" | "waitlist"
  // }
  app.post("/webhook/rsvp", checkWebhookAuth, async (req, res) => {
    const payload = req.body || {};

    console.log("📥 Webhook /rsvp from app:", JSON.stringify(payload, null, 2));

    broadcastUpdate({
      type: "app_rsvp",
      data: payload,
      ts: Date.now(),
    });

    // Later: update message buttons / fields in Discord here.
    return res.json({ ok: true });
  });

  // Create HTTP server + WebSocket server
  const server = createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    console.log("🔌 WebSocket client connected to Sync Hub.");

    socket.send(
      JSON.stringify({
        type: "hello",
        message: "Connected to Event Nexus Sync Hub",
        ts: Date.now(),
      })
    );

    socket.on("message", (message) => {
      try {
        const msg = JSON.parse(message.toString());
        console.log("📩 From WS client:", msg);

        // You can add handling here if the app wants to send commands to the bot
        // via WebSocket, e.g. { type: "create_event_in_discord", ... }
      } catch (err) {
        console.error("❌ Invalid WS message:", err);
      }
    });

    socket.on("close", () => {
      console.log("❌ WebSocket client disconnected from Sync Hub.");
    });
  });

  server.listen(PORT, () => {
    console.log(`🌐 WebSocket/HTTP sync hub listening on port ${PORT}`);
  });

  return { broadcastUpdate };
}

// Optional: so other modules (like create-event.js) can import just this
export { broadcastUpdate };
