// src/register-commands.js
import "dotenv/config";
import { REST, Routes } from "discord.js";
import commands from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const devGuildId = process.env.GUILD_ID; // optional – only for your server

if (!token || !clientId) {
  console.error("❌ Missing DISCORD_BOT_TOKEN or CLIENT_ID in env.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  try {
    // 1) Global commands – used by ANY server that installs your bot
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("✅ Registered GLOBAL slash commands");

    // 2) Optional: also register for your dev guild for instant updates
    if (devGuildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body: commands });
      console.log(`✅ Registered GUILD slash commands for dev server ${devGuildId}`);
    } else {
      console.log("ℹ️ No GUILD_ID set – skipping per-guild registration.");
    }
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

main();
