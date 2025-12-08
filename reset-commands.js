import "dotenv/config";
import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Get token from .env
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ Missing DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

// 2) Get clientId + guildId from config.json
let CLIENT_ID;
let GUILD_ID;

try {
  const cfgPath = path.join(__dirname, "config.json");
  const raw = fs.readFileSync(cfgPath, "utf8");
  const cfg = JSON.parse(raw);

  CLIENT_ID = cfg.clientId;
  GUILD_ID = cfg.guildId;

  if (!CLIENT_ID || !GUILD_ID) {
    console.error("❌ config.json is missing clientId or guildId");
    process.exit(1);
  }
} catch (err) {
  console.error("❌ Failed to read config.json for clientId/guildId:", err.message);
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, "src", "commands");
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const fullPath = path.join(commandsPath, file);
    const fileUrl = pathToFileURL(fullPath).href;

    const mod = await import(fileUrl);
    if (mod.data) {
      commands.push(mod.data.toJSON());
    }
  }
  return commands;
}

(async () => {
  try {
    console.log("🧨 Clearing existing GUILD commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [],
    });

    console.log("🧨 Clearing existing GLOBAL commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

    console.log("📦 Loading fresh commands from /src/commands...");
    const commands = await loadCommands();

    console.log("🔁 Re-registering commands (guild)...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log("✅ Commands reset & re-registered clean.");
    console.log("You now have EXACTLY ONE set of slash commands.");
  } catch (err) {
    console.error("❌ Reset failed:", err);
  }
})();
