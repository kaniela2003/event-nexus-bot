// src/commands/set-event-channel.js
import { SlashCommandBuilder } from "discord.js";
import axios from "axios";

const base = process.env.NEXUS_API_URL;

export const data = new SlashCommandBuilder()
  .setName("seteventchannel")
  .setDescription("Set this channel as the default Event Nexus announcement channel for this server.");

export async function execute(interaction) {
  if (!base) {
    return interaction.reply({
      content: "⚠ NEXUS_API_URL is not configured on the bot.",
      ephemeral: true,
    });
  }

  // Only ONE response chain:
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const eventChannelId = interaction.channelId;

  try {
    await axios.post(
      `${base.replace(/\/+$/, "")}/guild-settings`,
      {
        guildId,
        eventChannelId,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 8000,
      }
    );

    // SINGLE final reply → no duplicate responses
    await interaction.editReply(
      `✅ This channel (<#${eventChannelId}>) is now set as the Event Nexus announcement channel for this server.`
    );
  } catch (err) {
    const detail =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "Unknown error";

    await interaction.editReply(
      `⚠ I couldn't save this channel as the event channel.\n> ${detail}`
    );
  }
}
