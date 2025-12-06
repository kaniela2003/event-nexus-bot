// src/index.js
import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadCommands, registerGlobalCommands } from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}
if (!clientId) {
  console.error("❌ CLIENT_ID is not set.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Use the standard 'ready' event for discord.js v14
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Handle slash command interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands?.get(interaction.commandName);
  if (!command) {
    console.warn(`⚠️ No command handler found for /${interaction.commandName}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "⚠️ That command is not wired up correctly.",
        ephemeral: true,
      });
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`💥 Error running /${interaction.commandName}:`, error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "⚠️ Something went wrong while executing that command.",
      });
    } else {
      await interaction.reply({
        content: "⚠️ Something went wrong while executing that command.",
        ephemeral: true,
      });
    }
  }
});

(async () => {
  // Load command modules into client.commands
  await loadCommands(client);

  // Register global slash commands with Discord
  await registerGlobalCommands(clientId, token);

  // Log in the bot
  await client.login(token);
})();
