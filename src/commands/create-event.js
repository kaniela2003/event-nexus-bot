// src/commands/create-event.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createNexusEvent } from "../utils/api.js";

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
      .setName("capacity")
      .setDescription("Max players (optional)")
      .setRequired(false)
  );

export async function execute(interaction) {
  const title = interaction.options.getString("title", true);
  const timeInput = interaction.options.getString("time", true);
  const description = interaction.options.getString("description") ?? "";
  const capacity = interaction.options.getInteger("capacity") ?? null;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Map Discord input → Base44 Event entity fields
    const payload = {
      guild_id: interaction.guildId,
      type: "gta_event",
      title,
      description,
      image_url: null, // can link later
      start_time: timeInput, // keep as string for now
      end_time: null,
      capacity,
      status: "scheduled",
      vip_delay_minutes: null,
      staff_channel_id: null,
      vip_channel_id: null,
      public_channel_id: interaction.channelId,
      staff_message_id: null,
      vip_message_id: null,
      public_message_id: null,
      discord_invite_url: null,
      reminders_enabled: true,
      custom_reminder_minutes: null,
      media_followup_enabled: false,
      live_category_id: null,
      live_text_channel_id: null,
      live_voice_channel_id: null,
      archive_text_channel_id: null,
      season_id: null,
      created_by_discord_id: interaction.user.id,
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_end_date: null,
      parent_event_id: null,
      template_id: null,
      requires_approval: false,
      auto_assign_host: true,
    };

    const event = await createNexusEvent(payload);

    const embed = new EmbedBuilder()
      .setTitle(`✅ Event created: ${title}`)
      .setDescription(description || "No description provided.")
      .addFields(
        { name: "Time", value: timeInput, inline: true },
        { name: "Capacity", value: capacity ? `${capacity}` : "Not set", inline: true },
        { name: "Status", value: "Scheduled", inline: true },
        { name: "Event ID", value: String(event.id ?? "N/A"), inline: true }
      )
      .setFooter({ text: "Stored in Event Nexus (Base44)" })
      .setTimestamp(new Date());

    await interaction.editReply({
      embeds: [embed],
      // ephemeral: true is still fine even if Node prints a warning
    });
  } catch (err) {
    console.error("Error creating Event entity:", err.response?.data || err.message);

    await interaction.editReply({
      content:
        "⚠️ I couldn't sync this event to Nexus. The Discord side is fine, but the backend returned an error. Check Railway logs + Base44 app logs for details.",
    });
  }
}
