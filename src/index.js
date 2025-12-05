import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadCommands, registerGlobalCommands } from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Clean modern ready event (Discord.js v15 safe)
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

await loadCommands(client);

(async () => {
  // Register slash commands globally
  await registerGlobalCommands(clientId, token);

  // Login bot
  client.login(token);
})();
