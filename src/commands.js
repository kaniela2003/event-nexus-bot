// src/commands.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REST, Routes, Collection } from "discord.js";
import { getConfig } from "./utils/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all command modules from ./commands
 * Each file must export:
 *   export const data = new SlashCommandBuilder()...
 *   export async function execute(interaction) { ... }
 */
export async function loadCommands() {
  const commands = new Map();

  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    const commandModule = await import(filePath);
    const data = commandModule.data;
    const execute = commandModule.execute;

    if (!data || !execute) {
      console.warn(
        `⚠️ Skipping command file ${file} (missing data or execute export)`
      );
      continue;
    }

    commands.set(data.name, { data, execute });
  }

  console.log(`⚡ Loaded ${commands.size} commands.`);
  return commands;
}

/**
 * Register commands for a single guild (fast updates)
 * Uses clientId + guildId from config.json
 */
export async function registerGlobalCommands(commands) {
  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_BOT_TOKEN
  );

  // Turn command data into raw JSON for Discord API
  const body = [...commands.values()].map((c) => c.data.toJSON());

  try {
    console.log("🔃 Registering guild slash commands...");

    const cfg = getConfig();

    await rest.put(
      Routes.applicationGuildCommands(cfg.clientId, cfg.guildId),
      { body }
    );

    console.log(`✅ Registered ${body.length} guild slash commands.`);
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
    throw err;
  }
}
