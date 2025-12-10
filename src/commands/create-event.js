// src/commands/create-event.js

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import axios from "axios";

const apiBase = process.env.NEXUS_API_URL;

// Slash command definition
export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption(opt =>
    opt.setName("title").setDescription("Event title").setRequired(true)
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
  );

// Slash command handler
export const execute = async interaction => {
  const title = interaction.options.getString("title");
  const time = interaction.options.getString("time");
  const description =
    interaction.options.getString("description") || "No description provided.";

  await interaction.deferReply({ ephemeral: false });

  // RSVP buttons
  const rsvpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("event_rsvp_vip")
      .setLabel("VIP")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("event_rsvp_yes")
      .setLabel("Yes")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("event_rsvp_maybe")
      .setLabel("Maybe")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("event_rsvp_no")
      .setLabel("No")
      .setStyle(ButtonStyle.Danger)
  );

  // Build discord embed
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: "Time", value: time, inline: true },
      { name: "Created by", value: `<@${interaction.user.id}>`, inline: true }
    )
    .setFooter({ text: "Event Nexus" })
    .setTimestamp();

  // 1️⃣ Post event in Discord
  const message = await interaction.followUp({
    embeds: [embed],
    components: [rsvpRow]
  });

  // 2️⃣ Sync to Nexus backend
  const payload = {
    title,
    time,
    description,
    discordMessageId: message.id,
    discordChannelId: message.channel.id,
    guildId: interaction.guildId,
    createdById: interaction.user.id
  };

  try {
    const res = await axios.post(`${apiBase}/events`, payload, {
      timeout: 8000
    });

    console.log("Nexus API response:", res.status, res.data);

    await interaction.followUp(
      `✅ Synced to Event Nexus app. (Event ID: \`${res.data?.event?.id || "unknown"}\`)`
    );
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const short =
      typeof data === "string"
        ? data.slice(0, 200)
        : typeof data === "object"
        ? JSON.stringify(data).slice(0, 200)
        : err.message;

    console.error("Nexus API error:", status, data || err.message);

    await interaction.followUp(
      `⚠️ Event posted here, but sync FAILED.\n**HTTP:** ${status || "No response"}\n**Backend said:** \`${short}\``
    );
  }
};

// Button handler required by index.js
export async function handleEventButton(interaction) {
  const { customId, user } = interaction;
  if (!customId.startsWith("event_rsvp_")) return;

  const choice = customId.replace("event_rsvp_", "");

  await interaction.reply({
    content: `You selected **${choice.toUpperCase()}**, <@${user.id}>.`,
    ephemeral: true
  });
}
