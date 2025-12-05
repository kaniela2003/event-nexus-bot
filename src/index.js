import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadCommands, registerGlobalCommands } from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Updated for Discord.js v15 safety
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Load commands first
await loadCommands(client);

// Then register global slash commands
await registerGlobalCommands(clientId, token);

// Finally log in
client.login(token);
