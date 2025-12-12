// src/syncHub.js
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { EmbedBuilder } from "discord.js";

const PORT = process.env.PORT || process.env.SYNC_PORT || 3000;
const WEBHOOK_SECRET = process.env.NEXUS_WEBHOOK_SECRET || null;

// In-memory map (temporary; DB comes later)
const eventDiscordMap = new Map();

let wss = null;
let discordClient = null;

export function attachDiscordClient(client) {
  discordClient = client;
}

function broadcast(payload) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

export function startSyncHub() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_, res) => {
    res.json({ ok: true, service: "Event Nexus Sync Hub", version: "v1" });
  });

  function auth(req, res, next) {
    if (!WEBHOOK_SECRET) return next();
    if (req.headers["x-webhook-secret"] !== WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false });
    }
    next();
  }

  // 🔥 EVENT MIRROR (APP → DISCORD)
  app.post("/webhook/events", auth, async (req, res) => {
    try {
      const { action, event } = req.body;

      if (!discordClient) {
        console.error("❌ Discord client not attached");
        return res.status(500).json({ ok: false });
      }

      const channelId = event.discordChannelId || process.env.DEFAULT_EVENT_CHANNEL;
      const channel = await discordClient.channels.fetch(channelId);

      const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setDescription(event.description || "No description")
        .addFields({ name: "Time", value: event.time })
        .setFooter({ text: "Event Nexus" })
        .setTimestamp();

      let messageId = eventDiscordMap.get(event.id);

      if (action === "updated" && messageId) {
        const msg = await channel.messages.fetch(messageId);
        await msg.edit({ embeds: [embed] });
      } else {
        const msg = await channel.send({ embeds: [embed] });
        eventDiscordMap.set(event.id, msg.id);
        messageId = msg.id;
      }

      broadcast({ type: "event_mirrored", eventId: event.id, messageId });
      return res.json({ ok: true, messageId });

    } catch (err) {
      console.error("🔥 Mirror error:", err);
      return res.status(500).json({ ok: false });
    }
  });

  // RSVP WEBHOOK (for next step)
  app.post("/webhook/rsvp", auth, async (req, res) => {
    broadcast({ type: "app_rsvp", data: req.body });
    return res.json({ ok: true });
  });

  const server = createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", ws => {
    ws.send(JSON.stringify({ type: "connected", ts: Date.now() }));
  });

  server.listen(PORT, () => {
    console.log(`🌐 Sync Hub live on port ${PORT}`);
  });
}
