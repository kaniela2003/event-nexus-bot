// index.js — Event Nexus FINAL VERSION (auto global command sync, Railway-ready)

import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import commands from "./commands.js"; // auto-loads all commands in /commands folder

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Function to auto-register GLOBAL slash commands
async function registerGlobalCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.error("❌ Missing DISCORD_BOT_TOKEN or CLIENT_ID in env. Cannot register commands.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("✅ Global slash commands synced to Discord.");
  } catch (err) {
    console.error("❌ Error syncing slash commands:", err);
  }
}

// Bot ready event — this is where the magic happens
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Auto sync commands on every Railway boot
  await registerGlobalCommands();

  console.log("🚀 Event Nexus is fully online.");
});

// Log in
client.login(process.env.DISCORD_BOT_TOKEN);
