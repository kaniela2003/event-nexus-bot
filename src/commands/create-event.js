// src/commands/create-event.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createNexusEvent } from "../utils/api.js";

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
      .setName("capacity")
      .setDescription("Max players (optional)")
      .setRequired(false)
  );

export async function execute(interaction) {
  const title = interaction.options.getString("title", true);
  const timeInput = interaction.options.getString("time", true);
  const description = interaction.options.getString("description") ?? "";
  const capacity = interaction.options.getInteger("capacity") ?? null;

  // Private “receipt” for you
  await interaction.deferReply({ ephemeral: true });

  try {
    // Create event in Nexus backend
    const event = await createNexusEvent({
      title,
      time: timeInput,
      description,
      maxPlayers: capacity,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      createdBy: interaction.user.id,
    });

    // Build the public embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description || "No description provided.")
      .addFields(
        { name: "Time", value: timeInput, inline: true },
        {
          name: "Capacity",
          value: capacity ? String(capacity) : "Not set",
          inline: true,
        },
        {
          name: "Created By",
          value: `<@${interaction.user.id}>`,
          inline: true,
        },
        {
          name: "Event ID",
          value: event?.id ? String(event.id) : "N/A",
          inline: true,
        }
      )
      .setFooter({ text: "Synced with Event Nexus" })
      .setTimestamp(new Date());

    // 🔓 Public message in the channel
    const publicMessage = await interaction.channel.send({
      embeds: [embed],
    });

    // Optional: show the link to the public post in your private reply
    await interaction.editReply({
      content: `✅ Event created and posted: ${publicMessage.url}`,
      embeds: [],
    });
  } catch (err) {
    const backend = err.response?.data;
    console.error("Error syncing event to Nexus:", backend || err);

    const detail =
      backend?.error ||
      backend?.message ||
      (typeof backend === "string" ? backend : null) ||
      err.message ||
      "Unknown backend error";

    await interaction.editReply({
      content:
        "⚠️ I couldn't sync this event to the Nexus backend.\n> " + detail,
    });
  }
}
