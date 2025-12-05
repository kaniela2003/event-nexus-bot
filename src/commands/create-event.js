// src/commands/create-event.js

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import axios from "axios";

const apiBase = process.env.NEXUS_API_URL;

// Command definition
export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption(opt =>
    opt
      .setName("title")
      .setDescription("Event title")
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName("time")
      .setDescription("Event time (e.g. 2025-12-05 20:00 PST)")
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName("description")
      .setDescription("Short description of the event")
      .setRequired(false)
  )
  .addIntegerOption(opt =>
    opt
      .setName("max")
      .setDescription("Max players (optional)")
      .setRequired(false)
  );

// Command logic
export async function execute(interaction) {
  await interaction.deferReply();

  const title = interaction.options.getString("title", true);
  const time = interaction.options.getString("time", true);
  const description =
    interaction.options.getString("description") ?? "No description provided.";
  const max = interaction.options.getInteger("max") ?? null;

  let apiResult = "Event created locally (no Nexus sync).";

  // Try to sync to Nexus backend if NEXUS_API_URL is set
  if (apiBase) {
    try {
      const base = apiBase.replace(/\/$/, ""); // strip trailing slash
      const res = await axios.post(`${base}/events`, {
        title,
        time,
        description,
        maxPlayers: max,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdBy: interaction.user.id
      });

      const eventId = res.data?.id ?? res.data?.eventId ?? "unknown";
      apiResult = `Synced with Nexus (ID: ${eventId}).`;
    } catch (err) {
      console.error("❌ Error syncing event to Nexus API:", err?.message ?? err);
      apiResult =
        "⚠ Failed to sync with Nexus API, but the Discord event message was still created.";
    }
  }

  const fields = [
    { name: "Time", value: time, inline: true },
    { name: "Host", value: `<@${interaction.user.id}>`, inline: true }
  ];

  if (max !== null) {
    fields.push({ name: "Max Players", value: String(max), inline: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${title}`)
    .setDescription(description)
    .addFields(fields)
    .setFooter({ text: apiResult });

  await interaction.editReply({ embeds: [embed] });
}

// Default export so commands.js can use either style
export default { data, execute };
