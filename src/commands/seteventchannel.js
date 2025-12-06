// src/commands/seteventchannel.js
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { setConfig } from "../utils/config.js";

export const data = new SlashCommandBuilder()
  .setName("seteventchannel")
  .setDescription("Set the default channel for Event Nexus event announcements.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption(opt =>
    opt
      .setName("channel")
      .setDescription("Channel where Event Nexus will post events.")
      .setRequired(true)
  );

export async function execute(interaction) {
  const channel = interaction.options.getChannel("channel", true);

  if (!channel.isTextBased()) {
    return interaction.reply({
      content: "❌ That channel cannot receive event posts. Choose a text/announcement channel.",
      ephemeral: true,
    });
  }

  const updated = setConfig({ defaultEventChannelId: channel.id });

  console.log("[EventNexus] Default event channel set to:", updated.defaultEventChannelId);

  return interaction.reply({
    content: `✅ Default event channel set to ${channel} (\`${channel.id}\`).`,
    ephemeral: true,
  });
}
