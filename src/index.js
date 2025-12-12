import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { startSyncHub, attachDiscordClient } from "./syncHub.js";

// ✅ Hard-wire RSVP handlers so buttons NEVER go unhandled
import { handleEventButton, handleModal } from "./commands/rsvp-buttons.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

client.commands = new Collection();

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

startSyncHub();

client.once("clientReady", () => {
  attachDiscordClient(client);
  console.log(`🤖 Event Nexus bot ready as ${client.user.tag}`);
});

client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = client.commands.get(i.commandName);
      if (cmd) return await cmd.execute(i);
      return;
    }

    if (i.isButton()) {
      return await handleEventButton(i);
    }

    if (i.isModalSubmit()) {
      return await handleModal(i);
    }
  } catch (e) {
    console.error("❌ interaction error:", e);
    try {
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "⚠️ Interaction failed. Try again.", ephemeral: true });
      }
    } catch {}
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN missing");
  process.exit(1);
}

console.log("📡 Logging into Discord...");
client.login(token);
