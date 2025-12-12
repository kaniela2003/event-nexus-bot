import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.NEXUS_WEBHOOK_SECRET || null;

const DEFAULT_EVENT_CHANNEL = process.env.DEFAULT_EVENT_CHANNEL || null;
const STAFF_LOG_CHANNEL = process.env.STAFF_LOG_CHANNEL || null;

// Phase 1 memory store (later we persist to Base44)
export const rsvpStore = new Map();

let wss = null;
let discordClient = null;

export function attachDiscordClient(client) {
  discordClient = client;
}

function wsBroadcast(payload) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function auth(req, res, next) {
  if (!WEBHOOK_SECRET) return next();
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// CORS for Base44 browser preflight (this is what fixed app->discord)
function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://eventnexus.base44.app");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-webhook-secret");
}

function isPublicUrl(url) {
  return typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"));
}

function ensureState(eventId, maxPlayers) {
  if (!rsvpStore.has(eventId)) {
    rsvpStore.set(eventId, {
      maxPlayers: Number(maxPlayers) > 0 ? Number(maxPlayers) : 0,
      going: [],
      waitlist: [],
      messageId: null,
      channelId: null,
      staffMessageId: null,
      staffChannelId: null,
    });
  } else {
    const s = rsvpStore.get(eventId);
    if (Number(maxPlayers) > 0) s.maxPlayers = Number(maxPlayers);
  }
  return rsvpStore.get(eventId);
}

function counts(state) {
  return {
    maxPlayers: state.maxPlayers,
    going: state.going.length,
    waitlist: state.waitlist.length,
  };
}

export function buildRsvpRow(eventId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp_join:${eventId}`)
      .setLabel("RSVP ✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rsvp_cancel:${eventId}`)
      .setLabel("Cancel ❌")
      .setStyle(ButtonStyle.Danger)
  );
}

async function updateDiscordCounts(eventId) {
  const state = rsvpStore.get(eventId);
  if (!discordClient || !state?.channelId || !state?.messageId) return;

  const channel = await discordClient.channels.fetch(state.channelId).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(state.messageId).catch(() => null);
  if (!msg) return;

  const old = msg.embeds?.[0];
  const title = old?.title || "Event";
  const desc = old?.description || " ";

  const c = counts(state);
  const oldTimeField = (old?.fields || []).find(f => f?.name === "Time");

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .addFields(
      ...(oldTimeField ? [oldTimeField] : []),
      { name: "RSVP", value: state.maxPlayers > 0 ? `${c.going}/${c.maxPlayers}` : `${c.going}`, inline: true },
      { name: "Waitlist", value: `${c.waitlist}`, inline: true }
    )
    .setFooter({ text: "Event Nexus" })
    .setTimestamp();

  const img = old?.image?.url;
  if (img) embed.setImage(img);

  await msg.edit({ embeds: [embed], components: [buildRsvpRow(eventId)] });
}

export function startSyncHub() {
  const app = express();

  // CORS + preflight
  app.use((req, res, next) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_, res) => {
    res.json({ ok: true, service: "Event Nexus Sync Hub", version: "v1" });
  });

  // Helpful if you open in browser
  app.get("/webhook/events", (_, res) => res.status(405).json({ ok: false, error: "Use POST /webhook/events" }));
  app.get("/webhook/rsvp", (_, res) => res.status(405).json({ ok: false, error: "Use POST /webhook/rsvp" }));

  // App -> Discord event mirror (adds RSVP buttons)
  app.post("/webhook/events", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const action = body.action || "created";
      const event = body.event || body.data || body.payload || body || {};

      if (!event.id || !event.title || !event.time) {
        return res.status(400).json({ ok: false, error: "Missing event.id/title/time" });
      }
      if (!discordClient) return res.status(500).json({ ok: false, error: "Discord client not attached yet" });

      const channelId = event.discordChannelId || DEFAULT_EVENT_CHANNEL;
      if (!channelId) return res.status(400).json({ ok: false, error: "No Discord channel configured" });

      const channel = await discordClient.channels.fetch(channelId).catch(() => null);
      if (!channel) return res.status(400).json({ ok: false, error: "Could not fetch Discord channel" });

      const state = ensureState(event.id, event.maxPlayers);
      state.channelId = channelId;

      const c = counts(state);

      const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setDescription(event.description || "No description provided.")
        .addFields(
          { name: "Time", value: String(event.time), inline: false },
          { name: "RSVP", value: state.maxPlayers > 0 ? `${c.going}/${c.maxPlayers}` : `${c.going}`, inline: true },
          { name: "Waitlist", value: `${c.waitlist}`, inline: true }
        )
        .setFooter({ text: "Event Nexus" })
        .setTimestamp();

      if (isPublicUrl(event.imageUrl)) embed.setImage(event.imageUrl);

      const row = buildRsvpRow(event.id);
      const isUpdate = String(action).toLowerCase().includes("update");

      if (isUpdate && state.messageId) {
        const existing = await channel.messages.fetch(state.messageId).catch(() => null);
        if (existing) {
          await existing.edit({ embeds: [embed], components: [row] });
        } else {
          const sent = await channel.send({ embeds: [embed], components: [row] });
          state.messageId = sent.id;
        }
      } else {
        const sent = await channel.send({ embeds: [embed], components: [row] });
        state.messageId = sent.id;
      }

      wsBroadcast({ type: "event_mirrored", eventId: event.id, messageId: state.messageId, ts: Date.now() });
      return res.json({ ok: true, channelId, messageId: state.messageId });
    } catch (err) {
      console.error("🔥 /webhook/events error:", err);
      return res.status(500).json({ ok: false, error: "Mirror failed", message: err?.message || String(err) });
    }
  });

  // App -> Discord RSVP sync (Phase 1: update counts only)
  app.post("/webhook/rsvp", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const eventId = body.eventId || body.event?.id;
      if (!eventId) return res.status(400).json({ ok: false, error: "Missing eventId" });

      // If later you want: apply RSVP state here from body, then call updateDiscordCounts(eventId)
      await updateDiscordCounts(eventId);

      wsBroadcast({ type: "app_rsvp", data: body, ts: Date.now() });
      return res.json({ ok: true });
    } catch (err) {
      console.error("🔥 /webhook/rsvp error:", err);
      return res.status(500).json({ ok: false, error: "RSVP handler failed", message: err?.message || String(err) });
    }
  });

  const server = createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => ws.send(JSON.stringify({ type: "connected", ts: Date.now() })));

  server.listen(PORT, () => console.log(`🌐 SyncHub listening on port ${PORT}`));
}
