// src/index.js

import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";

// Start the Webhook + WebSocket Sync Hub
import { startSyncHub } from "./syncHub.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

console.log("🔍 Loading commands...");
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(`file://${filePath}`);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`⚡ Loaded command: ${command.data.name}`);
  } else {
    console.log(`❌ Command at ${file} missing required properties.`);
  }
}

// Load button handlers (like RSVP)
const buttonHandlers = {};
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const mod = await import(`file://${filePath}`);

  if (mod.handleEventButton) {
    buttonHandlers["event_rsvp"] = mod.handleEventButton;
  }
}

// Start the webhook + websocket sync hub ONCE
startSyncHub();

// Discord ready
client.once("clientReady", () => {
  console.log(`🤖 Event Nexus bot ready as ${client.user.tag}`);
});

// Interaction handler
client.on("interactionCreate", async interaction => {
  try {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }

    // Button interactions: RSVP
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("event_rsvp")) {
        await buttonHandlers["event_rsvp"](interaction);
      }
    }
  } catch (err) {
    console.error("❌ Interaction error:", err);
  }
});

// Log in
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ ERROR: DISCORD_BOT_TOKEN missing from environment!");
  process.exit(1);
}

console.log("📡 Logging into Discord...");
client.login(TOKEN);
