// src/commands/create-event.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";
import crypto from "node:crypto";
import { getConfig } from "../utils/config.js";
import { registerEvent } from "../rsvp.js";

const apiBase = process.env.NEXUS_API_URL;

export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Event title").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("time")
      .setDescription("Event time (e.g. 2025-12-05 20:00 PST)")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription("Short description of the event")
      .setRequired(false)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("slots")
      .setDescription("Max number of players for this event")
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("title", true);
  const time = interaction.options.getString("time", true);
  const description =
    interaction.options.getString("description") || "No description provided.";
  const maxSlots = interaction.options.getInteger("slots", true);

  const cfg = getConfig();

  let targetChannel = interaction.channel;
  if (cfg.defaultEventChannelId) {
    const candidate = interaction.client.channels.cache.get(
      cfg.defaultEventChannelId
    );
    if (candidate && candidate.isTextBased()) {
      targetChannel = candidate;
    }
  }

  // Generate a simple eventId for RSVP tracking
  const eventId =
    crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .addFields(
      {
        name: "Time",
        value: time,
        inline: false,
      },
      {
        name: `Spots (0/${maxSlots})`,
        value: "—",
        inline: false,
      },
      {
        name: "Waitlist (0)",
        value: "—",
        inline: false,
      }
    )
    .setFooter({ text: `Event ID: ${eventId}` })
    .setTimestamp(new Date());

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp:yes:${eventId}`)
      .setLabel("Yes")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rsvp:no:${eventId}`)
      .setLabel("No")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`rsvp:cancel:${eventId}`)
      .setLabel("Cancel RSVP")
      .setStyle(ButtonStyle.Secondary)
  );

  const message = await targetChannel.send({
    embeds: [embed],
    components: [buttons],
  });

  // Register event in memory for RSVP handling
  registerEvent(eventId, maxSlots);

  // OPTIONAL: sync with your app backend
  if (apiBase) {
    try {
      await axios.post(`${apiBase}/events`, {
        eventId,
        title,
        time,
        description,
        maxSlots,
        discordMessageId: message.id,
        discordChannelId: message.channel.id,
        guildId: message.guildId,
      });
    } catch (err) {
      console.error("[EventNexus] Failed to sync event to API:", err.message);
      // Not fatal to Discord flow
    }
  }

  await interaction.editReply(
    `✅ Event created and posted in ${targetChannel}.\nEvent ID: \`${eventId}\`, max slots: **${maxSlots}**.`
  );
}
