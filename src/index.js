// src/index.js
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

console.log("🔍 Loading commands...");
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
  const cmd = await import(`file://${path.join(commandsPath, file)}`);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`⚡ Loaded command: ${cmd.data.name}`);
  }
}

// Start SyncHub
startSyncHub();

client.once("clientReady", () => {
  attachDiscordClient(client);
  console.log(`🤖 Event Nexus Bot ready as ${client.user.tag}`);
});

client.on("interactionCreate", async i => {
  if (i.isChatInputCommand()) {
    const cmd = client.commands.get(i.commandName);
    if (cmd) await cmd.execute(i);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
