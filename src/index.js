import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { startSyncHub, attachDiscordClient } from "./syncHub.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// Load commands
console.log("🔍 Loading commands...");
const commandsPath = path.join(__dirname, "commands");
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of files) {
  const mod = await import(`file://${path.join(commandsPath, file)}`);
  if (mod?.data?.name && typeof mod.execute === "function") {
    client.commands.set(mod.data.name, mod);
    console.log(`⚡ Loaded command: ${mod.data.name}`);
  }
}

// Start SyncHub now (HTTP+WS)
startSyncHub();

client.once("clientReady", () => {
  attachDiscordClient(client);
  console.log(`🤖 Event Nexus bot ready as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
    }

    // If any command module exports handleEventButton, call it for button interactions
    if (interaction.isButton()) {
      for (const file of files) {
        const mod = await import(`file://${path.join(commandsPath, file)}`);
        if (typeof mod.handleEventButton === "function") {
          await mod.handleEventButton(interaction);
          break;
        }
      }
    }
  } catch (err) {
    console.error("❌ Interaction error:", err);
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ ERROR: DISCORD_BOT_TOKEN missing from environment!");
  process.exit(1);
}

console.log("📡 Logging into Discord...");
client.login(token);
