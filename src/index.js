// src/index.js
// Event Nexus Bot - Slash commands + normal run mode

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const config = require("../config.json");

// ---- Config + safety checks ----
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = config.clientId;
const guildId = config.guildId;

if (!token) {
  console.error("❌ No DISCORD_BOT_TOKEN found in environment. Set it in Railway Variables.");
  process.exit(1);
}

if (!clientId || !guildId) {
  console.error("❌ clientId or guildId missing in config.json");
  process.exit(1);
}

// ---- Define slash commands ----
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Test if the Event Nexus bot is responding."),
  new SlashCommandBuilder()
    .setName("nexus")
    .setDescription("Check Event Nexus bot status."),
].map((command) => command.toJSON());

// ---- Mode 1: register slash commands and exit ----
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("⏳ Refreshing application (guild) commands...");

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("✅ Successfully registered slash commands for guild:", guildId);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error registering commands:", error);
    process.exit(1);
  }
}

// ---- Mode 2: normal bot runtime ----
async function startBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // slash commands only need this
    ],
  });

  client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      if (interaction.commandName === "ping") {
        await interaction.reply({ content: "Pong 🏓", ephemeral: true });
      } else if (interaction.commandName === "nexus") {
        await interaction.reply({
          content: "Event Nexus bot is online and connected ✅",
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("❌ Error handling interaction:", err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Something went wrong handling that command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Something went wrong handling that command.",
          ephemeral: true,
        });
      }
    }
  });

  await client.login(token);
}

// ---- Decide mode based on command-line args ----
if (process.argv[2] === "register") {
  registerCommands();
} else {
  startBot();
}
