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

// Standard ready event
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Slash command handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return interaction.reply({
      content: "⚠️ Command not wired correctly.",
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`💥 Error running /${interaction.commandName}:`, err);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "⚠️ Something went wrong while executing.",
      });
    } else {
      await interaction.reply({
        content: "⚠️ Something went wrong while executing.",
        ephemeral: true,
      });
    }
  }
});

(async () => {
  // 🔥 FIX: assign loaded commands into client.commands
  client.commands = await loadCommands(client);

  // Register guild commands
  await registerGlobalCommands(client.commands);

  // Login the bot
  await client.login(token);
})();
