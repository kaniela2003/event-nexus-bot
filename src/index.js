import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { startSyncHub, attachDiscordClient } from "./syncHub.js";

import { handleEventButton, handleModal } from "./commands/rsvp-buttons.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("unhandledRejection", (err) => console.error("ðŸ”¥ unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("ðŸ”¥ uncaughtException:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

console.log("ðŸ” Loading commands...");
const commandsPath = path.join(__dirname, "commands");
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of files) {
  const mod = await import(`file://${path.join(commandsPath, file)}`);
  if (mod?.data?.name && typeof mod.execute === "function") {
    client.commands.set(mod.data.name, mod);
    console.log(`âš¡ Loaded command: ${mod.data.name}`);
  }
}

startSyncHub();

// âœ… Support BOTH discord.js v14 and v15
client.once("ready", () => {
  attachDiscordClient(client);
  console.log(`ðŸ¤– READY as ${client.user.tag}`);
});

client.once("clientReady", () => {
  attachDiscordClient(client);
  console.log(`ðŸ¤– CLIENTREADY as ${client.user.tag}`);
});

// âœ… Always acknowledge interactions fast (prevents â€œinteraction failedâ€)
client.on("interactionCreate", async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const cmd = client.commands.get(i.commandName);
      if (!cmd) return;
      return await cmd.execute(i);
    }

    if (i.isButton()) {
      console.log(`ðŸ§· Button: ${i.customId} by ${i.user?.tag || i.user?.id}`);

      // For cancel button we can defer instantly; for join we must show modal
      if (String(i.customId || "").startsWith("rsvp_cancel:")) {
        if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      }

      return await handleEventButton(i);
    }

    if (i.isModalSubmit()) {
      console.log(`ðŸ§¾ Modal: ${i.customId} by ${i.user?.tag || i.user?.id}`);
      if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
      return await handleModal(i);
    }

  } catch (e) {
    console.error("âŒ interactionCreate error:", e);

    // Last resort: always respond so Discord doesnâ€™t time out
    try {
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "âš ï¸ Interaction failed. Try again.", ephemeral: true });
      } else if (i.deferred && !i.replied) {
        await i.editReply("âš ï¸ Interaction failed. Try again.");
      }
    } catch {}
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("âŒ DISCORD_BOT_TOKEN missing");
  process.exit(1);
}

console.log("ðŸ“¡ Logging into Discord...");
client.login(token);