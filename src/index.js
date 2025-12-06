// src/index.js
import "dotenv/config";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import { loadCommands, registerGlobalCommands } from "./commands.js";
import { handleEventButton } from "./commands/create-event.js";

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Will hold all slash commands keyed by name
client.commands = new Collection();

async function init() {
  try {
    console.log("🔍 Loading commands...");
    const commands = await loadCommands();
    client.commands = commands;

    console.log("📡 Logging into Discord...");
    await client.login(process.env.DISCORD_BOT_TOKEN);

    console.log("📦 Registering guild slash commands...");
    await registerGlobalCommands(commands);

    console.log("🤖 Event Nexus bot is fully online.");
  } catch (err) {
    console.error("❌ Failed to initialize bot:", err);
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Handle slash commands + RSVP buttons
client.on("interactionCreate", async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`⚠️ Unknown command: /${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
      return;
    }

    // Event RSVP buttons (Yes / No / Cancel)
    if (interaction.isButton()) {
      await handleEventButton(interaction);
      return;
    }
  } catch (err) {
    console.error("❌ Error handling interaction:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong handling that interaction.",
        ephemeral: true,
      });
    }
  }
});

// Boot the bot
init();
