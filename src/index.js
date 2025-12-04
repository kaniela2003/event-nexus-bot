// index.js
// Clean Event Nexus bot bootstrap

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

// Make sure you installed discord.js:
// npm install discord.js dotenv

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// ---- Basic startup ----
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---- Example simple ping command (slash or text) ----
// You can expand this later; for now it proves the bot is alive.
client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "!ping") {
    message.reply("Pong 🏓");
  }
});

// ---- Login with token from .env ----
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("❌ No DISCORD_BOT_TOKEN found in .env");
  process.exit(1);
}

client.login(token);
