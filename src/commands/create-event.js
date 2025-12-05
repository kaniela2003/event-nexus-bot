import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { createNexusEvent } from "../utils/api.js";

export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption(o =>
    o.setName("title").setDescription("Event title").setRequired(true)
  )
  .addStringOption(o =>
    o.setName("time").setDescription("Event time").setRequired(true)
  )
  .addStringOption(o =>
    o.setName("description").setDescription("Description")
  )
  .addIntegerOption(o =>
    o.setName("capacity").setDescription("Max players")
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("title");
  const time = interaction.options.getString("time");
  const description = interaction.options.getString("description") ?? "";
  const capacity = interaction.options.getInteger("capacity") ?? null;

  try {
    const event = await createNexusEvent({
      title,
      time,
      description,
      maxPlayers: capacity,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      createdBy: interaction.user.id
    });

    const embed = new EmbedBuilder()
      .setTitle(`Event Created: ${title}`)
      .setDescription(description)
      .addFields(
        { name: "Time", value: time, inline: true },
        { name: "Capacity", value: capacity ? String(capacity) : "None", inline: true },
        { name: "Event ID", value: event.id ?? "N/A", inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error("Event creation error:", err.response?.data || err.message);

    await interaction.editReply({
      content: "⚠️ Could not sync event to backend. Check Railway + Base44 logs."
    });
  }
}
