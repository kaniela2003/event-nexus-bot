// src/commands/create-event.js

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import axios from "axios";

const apiBase = process.env.NEXUS_API_URL;

// Slash command definition
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
  );

// Main slash command handler
export const execute = async (interaction) => {
  const title = interaction.options.getString("title");
  const time = interaction.options.getString("time");
  const description =
    interaction.options.getString("description") ?? "No description provided.";

  await interaction.deferReply({ ephemeral: false });

  // RSVP buttons (we can hook these up more later)
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
      .setStyle(ButtonStyle.Danger),
  );

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: "Time", value: time, inline: true },
      { name: "Created by", value: `<@${interaction.user.id}>`, inline: true }
    )
    .setFooter({ text: "Event Nexus" })
    .setTimestamp();

  // 1) Post event in Discord
  const message = await interaction.followUp({
    embeds: [embed],
    components: [rsvpRow],
  });

  // 2) Try to sync to Event Nexus backend
  try {
    const payload = {
      title,
      time,
      description,
      discordMessageId: message.id,
      discordChannelId: message.channel.id,
      guildId: interaction.guildId,
      createdById: interaction.user.id,
    };

    const res = await axios.post(`${apiBase}/events`, payload, {
      timeout: 8000,
    });

    console.log("Nexus API response:", res.status, res.data);

    if (res.data?.error || res.status >= 400) {
      await interaction.followUp(
        `⚠️ Event posted in Discord, but Nexus sync might have failed: ${
          res.data?.error || "Unknown error from backend."
        }`
      );
    } else {
      const eventId = res.data?.event?.id || res.data?.id || "unknown";
      await interaction.followUp(
        `✅ Synced to Event Nexus app. (Event ID: \`${eventId}\`)`
      );
    }
  } catch (err) {
    console.error(
      "Nexus API error:",
      err.response?.status,
      err.response?.data || err.message
    );

    await interaction.followUp(
      "⚠️ Event posted here, but I couldn't sync it to the Event Nexus app."
    );
  }
};

// Button handler for RSVP interactions
export async function handleEventButton(interaction) {
  const { customId, user } = interaction;

  // Only handle our event RSVP buttons
  if (!customId.startsWith("event_rsvp_")) return;

  const choice = customId.replace("event_rsvp_", ""); // vip / yes / maybe / no / waitlist?

  // Later we can sync this choice to the backend (/events/:id/rsvp).
  // For now, just confirm to the user.
  await interaction.reply({
    content: `You selected **${choice.toUpperCase()}** for this event, <@${user.id}>.`,
    ephemeral: true,
  });
}
