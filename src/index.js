// src/index.js — Event Nexus bot (global commands, Railway-ready)
// redeploy trigger

import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, Partials } from "discord.js";
import { slashCommands, commandHandlers } from "./commands.js";

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// Auto-register GLOBAL slash commands (works for ANY server that installs the bot)
async function registerGlobalCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.error("❌ Missing DISCORD_BOT_TOKEN or CLIENT_ID in env. Cannot register commands.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    console.log("✅ Global slash commands synced to Discord.");
  } catch (err) {
    console.error("❌ Error syncing slash commands:", err);
  }
}

// When bot is ready
client.once("clientready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Sync slash commands on every Railway boot
  await registerGlobalCommands();

  console.log("🚀 Event Nexus is fully online.");
});

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const handler = commandHandlers.get(interaction.commandName);

  if (!handler) {
    console.warn(`⚠️ No handler for command: ${interaction.commandName}`);
    try {
      await interaction.reply({ content: "This command is not implemented yet.", ephemeral: true });
    } catch {
      // ignore
    }
    return;
  }

  try {
    await handler(interaction);
  } catch (err) {
    console.error(`❌ Error running command ${interaction.commandName}:`, err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: "Something went wrong running that command.", ephemeral: true });
    } else {
      await interaction.reply({ content: "Something went wrong running that command.", ephemeral: true });
    }
  }
});

// Log in
client.login(process.env.DISCORD_BOT_TOKEN);
