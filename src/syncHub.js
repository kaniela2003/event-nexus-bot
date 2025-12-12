import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";

const PORT = process.env.PORT || process.env.SYNC_PORT || 3000;
const WEBHOOK_SECRET = process.env.NEXUS_WEBHOOK_SECRET || null;

// Optional default channel fallback (recommended)
const DEFAULT_EVENT_CHANNEL = process.env.DEFAULT_EVENT_CHANNEL || null;

// In-memory map: Base44 eventId -> Discord messageId (temporary; DB storage later)
const eventDiscordMap = new Map();

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
  if (!WEBHOOK_SECRET) return next(); // dev mode
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// Best-effort: If Base44 image URLs aren't public, Discord won't display them.
// We'll set image only when imageUrl looks public; otherwise skip.
// Later upgrade: bot downloads & re-uploads as attachment.
function isProbablyPublicUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

async function updateDiscordForEvent(client, state, eventId) {
  if (!state.channelId || !state.messageId) return;

  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(state.messageId).catch(() => null);
  if (!msg) return;

  const old = msg.embeds?.[0];
  const title = old?.title || "Event";
  const desc = old?.description || " ";

  const c = counts(state);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .addFields(
      // preserve Time field if present
      ...(((old?.fields || []).filter(f => f?.name === "Time")) || []),
      { name: "RSVP", value: state.maxPlayers > 0 ? `${c.going}/${c.maxPlayers}` : `${c.going}`, inline: true },
      { name: "Waitlist", value: `${c.waitlist}`, inline: true }
    )
    .setFooter({ text: "Event Nexus" })
    .setTimestamp();

  const img = old?.image?.url;
  if (img) embed.setImage(img);

  await msg.edit({ embeds: [embed], components: [buildRsvpRow(eventId)] });
}

async function updateStaffRoster(client, state, eventId) {
  const staffChannelId = STAFF_LOG_CHANNEL || state.channelId;
  if (!staffChannelId) return;

  const channel = await client.channels.fetch(staffChannelId).catch(() => null);
  if (!channel) return;

  const roster = formatRoster(state, client);

  const embed = new EmbedBuilder()
    .setTitle(`Staff Roster — ${eventId}`)
    .addFields(
      { name: `Going (${state.going.length})`, value: roster.goingText.slice(0, 3900) || "None" },
      { name: `Waitlist (${state.waitlist.length})`, value: roster.waitText.slice(0, 3900) || "None" }
    )
    .setFooter({ text: "Staff only" })
    .setTimestamp();

  if (state.staffMessageId) {
    const msg = await channel.messages.fetch(state.staffMessageId).catch(() => null);
    if (msg) return await msg.edit({ embeds: [embed] });
  }

  const sent = await channel.send({ embeds: [embed] });
  state.staffMessageId = sent.id;
  state.staffChannelId = staffChannelId;
}

export function startSyncHub() {
  const app = express();

// ===== GLOBAL CORS HANDLER (Base44 browser preflight) =====
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://eventnexus.base44.app");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-webhook-secret");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: "5mb" }));

  // ===== REQUEST LOGGER (helps debug Base44 provider) =====
  app.use((req, res, next) => {
    const ts = new Date().toISOString();
    console.log(`🧾 [${ts}] ${req.method} ${req.originalUrl}`);
    console.log("   Headers:", JSON.stringify(req.headers));
    next();
  });

  app.get("/health", (_, res) => {
    res.json({ ok: true, service: "Event Nexus Sync Hub", version: "v1" });
  });

  // -----------------------------
  // APP -> BOT: Mirror Events
  // POST /webhook/events
  // Body:
  // { source:"app", action:"created"|"updated", event:{ id,title,time,description,maxPlayers,imageUrl,discordChannelId } }
  // -----------------------------
  app.post("/webhook/events", auth, async (req, res) => {
    try {
      const body = req.body || {};
      const action = body.action || "created";
      const event = body.event || {};

      console.log("📥 Webhook /events:", JSON.stringify(body));

      if (!event.id || !event.title || !event.time) {
        return res.status(400).json({ ok: false, error: "Missing required fields: event.id/title/time" });
      }

      if (!discordClient) {
        return res.status(500).json({ ok: false, error: "Discord client not attached yet" });
      }

      const channelId = event.discordChannelId || DEFAULT_EVENT_CHANNEL;
      if (!channelId) {
        return res.status(400).json({ ok: false, error: "No Discord channel configured (discordChannelId or DEFAULT_EVENT_CHANNEL)" });
      }

      const channel = await discordClient.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return res.status(400).json({ ok: false, error: "Could not fetch Discord channel" });
      }

      const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setDescription(event.description || "No description provided.")
        .addFields({ name: "Time", value: formatTimeRange(event), inline: false })
        .setFooter({ text: "Event Nexus" })
        .setTimestamp();

      // Optional: show maxPlayers if provided
      if (event.maxPlayers !== null && event.maxPlayers !== undefined && event.maxPlayers !== "") {
        embed.addFields({ name: "Max Players", value: String(event.maxPlayers), inline: true });
      }

      // Optional: image if URL is public
      if (isProbablyPublicUrl(event.imageUrl)) {
        embed.setImage(event.imageUrl);
      }

      let messageId = eventDiscordMap.get(event.id);

      if (action === "updated" && messageId) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed] });
        } else {
          const newMsg = await channel.send({ embeds: [embed] });
          messageId = newMsg.id;
          eventDiscordMap.set(event.id, messageId);
        }
      } else {
        const msg = await channel.send({ embeds: [embed] });
        messageId = msg.id;
        eventDiscordMap.set(event.id, messageId);
      }

      wsBroadcast({ type: "event_mirrored", action, eventId: event.id, channelId, messageId, ts: Date.now() });

      console.log(`✅ Mirrored ${event.id} -> Discord message ${messageId} in channel ${channelId}`);

      return res.json({ ok: true, channelId, messageId });
    } catch (err) {
      console.error("🔥 /webhook/events error:", err);
      return res.status(500).json({ ok: false, error: "Mirror failed", message: err?.message || String(err) });
    }
  });

  // -----------------------------
  // APP -> BOT: Mirror RSVP (placeholder for next phase)
  // POST /webhook/rsvp
  // -----------------------------
    // App -> Bot RSVP sync (applies to Discord + forwards to app for persistence)
  app.post("/webhook/rsvp", auth, async (req, res) => {
    try {
      const body = req.body || {};
      // Accept shapes:
      // { eventId, userId, status, psn?, ig? }
      // { event: { id }, user: { id }, action/status }
      const eventId = body.eventId || body.event?.id || body.event?.eventId || null;
      const userId = body.userId || body.user?.id || body.user?.userId || null;
      const statusRaw = (body.status || body.action || "").toString().toLowerCase();

      if (!eventId || !userId) {
        return res.status(400).json({ ok: false, error: "Missing eventId/userId" });
      }

      const state = ensureState(rsvpStore, eventId, body.maxPlayers);
      const entry = { userId, psn: (body.psn || null), ig: (body.ig || null) };

      const isCancel = statusRaw.includes("cancel") || statusRaw === "no" || statusRaw === "leave";
      const isJoin = !isCancel; // default join

      if (isCancel) {
        removeUser(state.going, userId);
        removeUser(state.waitlist, userId);
        promoteIfPossible(state);
      } else {
        // join/update details
        if (isIn(state.going, userId)) upsertUser(state.going, entry);
        else if (isIn(state.waitlist, userId)) upsertUser(state.waitlist, entry);
        else {
          const capped = state.maxPlayers && state.maxPlayers > 0;
          if (!capped || state.going.length < state.maxPlayers) state.going.push(entry);
          else state.waitlist.push(entry);
        }
      }

      // Update Discord views
      if (discordClient) {
        await updateDiscordForEvent(discordClient, state, eventId);
        await updateStaffRoster(discordClient, state, eventId);
      }

      // Forward to app (best-effort)
      await postRsvpToApp({
        type: "rsvp_update",
        eventId,
        userId,
        status: isCancel ? "cancel" : "rsvp",
        psn: entry.psn,
        ig: entry.ig,
      });

      wsBroadcast({ type: "rsvp_synced_from_app", eventId, userId, status: isCancel ? "cancel" : "rsvp", ts: Date.now() });

      return res.json({ ok: true });
    } catch (err) {
      console.error("🔥 /webhook/rsvp error:", err);
      return res.status(500).json({ ok: false, error: "RSVP sync failed", message: err?.message || String(err) });
    }
  });return res.json({ ok: true });
  });

  const server = createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected", ts: Date.now() }));
  });

  server.listen(PORT, () => {
    console.log(`🌐 WebSocket/HTTP SyncHub listening on port ${PORT}`);
  });
}




