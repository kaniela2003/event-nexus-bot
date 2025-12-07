// src/index.js
import "dotenv/config";
import http from "node:http";
import { WebSocketServer } from "ws";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { loadCommands, registerGlobalCommands } from "./commands.js";
import { handleEventButton } from "./commands/create-event.js";

// ----------------------------------------
// Discord client
// ----------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ----------------------------------------
// WebSocket setup
// ----------------------------------------
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Simple health check for Railway / browser
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "Event Nexus WS" }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

/**
 * Keep track of connected WebSocket clients
 */
const wsClients = new Set();

wss.on("connection", (socket) => {
  console.log("🌐 WebSocket client connected");
  wsClients.add(socket);

  socket.on("close", () => {
    console.log("🌐 WebSocket client disconnected");
    wsClients.delete(socket);
  });

  socket.on("error", (err) => {
    console.error("🌐 WebSocket error:", err);
  });

  // Optional: handle inbound messages from app if needed later
  socket.on("message", (data) => {
    console.log("🌐 Received from client:", data.toString());
  });
});

/**
 * Helper to broadcast JSON to all WS clients
 */
export function broadcastToApp(payload) {
  const data = JSON.stringify(payload);
  for (const socket of wsClients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(data);
    }
  }
}

// ----------------------------------------
// Init Discord bot
// ----------------------------------------
async function initBot() {
  try {
    console.log("🔍 Loading commands...");
    const commands = await loadCommands();
    client.commands = commands;

    console.log("📡 Logging into Discord...");
    await client.login(process.env.DISCORD_BOT_TOKEN);

    console.log("📦 Registering guild slash commands...");
    await registerGlobalCommands(commands);

    console.log("🤖 Event Nexus bot ready.");
  } catch (err) {
    console.error("❌ Failed to initialize bot:", err);
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Handle slash commands + RSVP buttons
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`⚠️ Unknown command: /${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleEventButton(interaction);
      return;
    }
  } catch (err) {
    console.error("❌ Error handling interaction:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong handling that interaction.",
        ephemeral: true,
      });
    }
  }
});

// ----------------------------------------
// Start HTTP+WS server + bot
// ----------------------------------------
server.listen(PORT, () => {
  console.log(`🌐 WebSocket/HTTP server listening on port ${PORT}`);
  initBot();
});
