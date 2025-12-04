// src/index.js
// Event Nexus Bot - Slash commands + Nexus polling

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const axios = require("axios");
const config = require("../config.json");

// ---- Config + safety checks ----
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = config.clientId;
const guildId = config.guildId;
const base44ApiUrl = process.env.BASE44_API_URL;
const base44ApiKey = process.env.BASE44_API_KEY;

if (!token) {
  console.error("❌ No DISCORD_BOT_TOKEN found in environment.");
  process.exit(1);
}
if (!clientId || !guildId) {
  console.error("❌ clientId or guildId missing in config.json");
  process.exit(1);
}
if (!base44ApiUrl || !base44ApiKey) {
  console.warn("⚠️ BASE44_API_URL or BASE44_API_KEY not set. Nexus features will be disabled.");
}

// ---- Define slash commands ----
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Test if the Event Nexus bot is responding."),
  new SlashCommandBuilder()
    .setName("nexus")
    .setDescription("Check Event Nexus + upcoming events.")
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

// ---- Helper: fetch upcoming events from Event Nexus ----
async function fetchEventsWindow(windowMinutes = 30) {
  if (!base44ApiUrl || !base44ApiKey) {
    return [];
  }

  try {
    const url = `${base44ApiUrl.replace(/\/$/, "")}/bot/events/window?windowMinutes=${windowMinutes}`;

    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${base44ApiKey}`,
      },
      timeout: 10000,
    });

    if (!Array.isArray(res.data)) {
      console.warn("⚠️ Nexus returned non-array response");
      return [];
    }

    return res.data;
  } catch (err) {
    console.error("❌ Error fetching Nexus events:", err.message);
    return [];
  }
}

// ---- Mode 2: normal bot runtime ----
async function startBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds, // slash commands
    ],
  });

  client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    if (!base44ApiUrl || !base44ApiKey) {
      console.warn("⚠️ Nexus integration disabled (missing BASE44 env vars).");
    } else {
      console.log("🛰️ Nexus integration enabled.");
    }
  });

  // Slash commands handling
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      if (interaction.commandName === "ping") {
        await interaction.reply({ content: "Pong 🏓", ephemeral: true });
      } else if (interaction.commandName === "nexus") {
        let msg = "Event Nexus bot is online ✅";

        if (base44ApiUrl && base44ApiKey) {
          const events = await fetchEventsWindow(60);
          msg += `\n\nNexus API: ✅`;
          msg += `\nUpcoming events in next 60 min: **${events.length}**`;

          if (events[0]) {
            msg += `\nNext: **${events[0].title}** at ${events[0].startTime}`;
          }
        } else {
          msg += `\nNexus API: ⚠️ Not configured (missing BASE44 env vars).`;
        }

        await interaction.reply({ content: msg, ephemeral: true });
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

  // Background polling (for logging only right now)
  if (base44ApiUrl && base44ApiKey) {
    setInterval(async () => {
      const events = await fetchEventsWindow(30);
      console.log(`🛰️ Nexus poll: ${events.length} event(s) in next 30 min`);
    }, 30000);
  }

  await client.login(token);
}

// ---- Decide mode ----
if (process.argv[2] === "register") {
  registerCommands();
} else {
  startBot();
}
