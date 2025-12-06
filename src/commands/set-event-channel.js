// src/commands/set-event-channel.js
import { SlashCommandBuilder } from "discord.js";
import axios from "axios";

const base = process.env.NEXUS_API_URL; 
// NEXUS_API_URL should already be: https://eventnexus.base44.app/functions/api

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

  const guildId = interaction.guildId;
  const eventChannelId = interaction.channelId;

  try {
    await interaction.deferReply({ ephemeral: true });

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

    await interaction.editReply({
      content: `✅ This channel (<#${eventChannelId}>) is now set as the default Event Nexus announcement channel for this server.`,
    });
  } catch (err) {
    console.error("Error saving guild settings:", err.response?.data || err.message);

    const detail =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "Unknown error";

    await interaction.editReply({
      content: `⚠ I couldn't save this channel as the event channel.\n> ${detail}`,
    });
  }
}
