import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";

import { startSyncHub, attachDiscordClient } from "./syncHub.js";
import { handleRsvpButton } from "./rsvp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("unhandledRejection", (err) => console.error("🔥 unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("🔥 uncaughtException:", err));

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
const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of files) {
  const mod = await import(`file://${path.join(commandsPath, file)}`);
  if (mod?.data?.name && typeof mod.execute === "function") {
    client.commands.set(mod.data.name, mod);
    console.log(`⚡ Loaded command: ${mod.data.name}`);
  }
}

startSyncHub();

client.once("ready", () => {
  attachDiscordClient(client);
  console.log(`🤖 READY as ${client.user.tag}`);
});

client.once("clientReady", () => {
  attachDiscordClient(client);
  console.log(`🤖 CLIENTREADY as ${client.user.tag}`);
});

client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = client.commands.get(i.commandName);
      if (!cmd) return;
      return await cmd.execute(i);
    }

    // RSVP Buttons (2-button system)
    if (i.isButton()) {
      const id = String(i.customId || "");
      if (id.startsWith("rsvp:")) {
        console.log(`🧷 RSVP Button: ${id} by ${i.user?.tag || i.user?.id}`);
        // IMPORTANT: Do NOT deferReply here — rsvp.js uses interaction.update()
        return await handleRsvpButton(i);
      }
      return;
    }
  } catch (e) {
    console.error("❌ interactionCreate error:", e);
    try {
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "⚠️ Interaction failed. Try again.", ephemeral: true });
      } else if (i.deferred && !i.replied) {
        await i.editReply("⚠️ Interaction failed. Try again.");
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
