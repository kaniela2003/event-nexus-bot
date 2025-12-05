// src/commands/create-event.js

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import axios from "axios";

const apiBase = process.env.NEXUS_API_URL;

export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption(opt =>
    opt.setName("title").setDescription("Event title").setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName("time").setDescription("Event time").setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName("description").setDescription("Event description")
  )
  .addIntegerOption(opt =>
    opt.setName("max").setDescription("Max players")
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const title = interaction.options.getString("title", true);
  const time = interaction.options.getString("time", true);
  const description = interaction.options.getString("description") ?? "No description provided.";
  const max = interaction.options.getInteger("max") ?? null;

  let apiResult = "Event created locally.";

  if (apiBase) {
    try {
      const base = apiBase.replace(/\/$/, "");
      const res = await axios.post(`${base}/events`, {
        title,
        time,
        description,
        maxPlayers: max,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdBy: interaction.user.id
      });

      apiResult = `Event synced to Nexus (ID: ${res.data?.id ?? "unknown"})`;
    } catch (err) {
      console.error("Nexus API Sync Failed:", err);
      apiResult = "⚠ Failed to sync to Nexus.";
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${title}`)
    .setDescription(description)
    .addFields(
      { name: "Time", value: time, inline: true },
      { name: "Host", value: `<@${interaction.user.id}>`, inline: true },
      max !== null ? { name: "Max Players", value: String(max), inline: true } : null
    )
    .setFooter({ text: apiResult });

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
