import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, Collection, GatewayIntentBits, REST, Routes } from "discord.js";

import { startSyncHub, attachDiscordClient } from "./syncHub.js";
import { handleRsvpButton } from "./rsvp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("unhandledRejection", (err) => console.error("🔥 unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("🔥 uncaughtException:", err));

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

// Prefer Railway env vars, fallback to config.json (your repo already has it)
const cfg = readJsonSafe(path.join(__dirname, "..", "config.json")) || {};
const clientId = process.env.CLIENT_ID || cfg.clientId;
const guildId  = process.env.GUILD_ID  || cfg.guildId;

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN missing");
  process.exit(1);
}
if (!clientId) {
  console.error("❌ CLIENT_ID missing (env or config.json)");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

async function loadCommandModules() {
  const commandsPath = path.join(__dirname, "commands");
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  const body = [];

  for (const file of files) {
    const modUrl = pathToFileURL(path.join(commandsPath, file)).href;
    const mod = await import(modUrl);

    if (!mod?.data?.name || typeof mod.execute !== "function") continue;

    client.commands.set(mod.data.name, mod);
    body.push(mod.data.toJSON());
  }

  return body;
}

async function registerSlashCommands(body) {
  const rest = new REST({ version: "10" }).setToken(token);

  // Fast dev path: guild commands when guildId exists; otherwise global
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`✅ Registered ${body.length} GUILD slash commands.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`✅ Registered ${body.length} GLOBAL slash commands.`);
  }
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Start SyncHub (webhook + websocket hybrid) and attach the Discord client
  try {
    startSyncHub();
    attachDiscordClient(client);
    console.log("✅ SyncHub online (webhook + websocket).");
  } catch (e) {
    console.error("⚠️ SyncHub failed to start:", e?.message || e);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // Buttons (RSVP)
    if (interaction.isButton()) {
      return await handleRsvpButton(interaction);
    }

    // Slash commands
    if (!interaction.isChatInputCommand()) return;

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) {
      return interaction.reply({ content: "❌ Command not found.", ephemeral: true }).catch(() => {});
    }

    // Prevent "interaction failed"
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    await cmd.execute(interaction, client);
  } catch (err) {
    console.error("❌ interactionCreate error:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply("❌ Something broke. Check logs.").catch(() => {});
      } else {
        await interaction.reply({ content: "❌ Something broke. Check logs.", ephemeral: true }).catch(() => {});
      }
    } catch {}
  }
});

console.log("🔍 Loading commands...");
const body = await loadCommandModules();
await registerSlashCommands(body);

console.log("📡 Logging into Discord...");
client.login(token);