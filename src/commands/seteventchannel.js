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
  try {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel("channel", true);

    if (!channel.isTextBased()) {
      return interaction.editReply(
        "❌ That channel cannot receive event posts. Choose a text or announcement channel."
      );
    }

    let updated;
    try {
      updated = setConfig({ defaultEventChannelId: channel.id });
    } catch (err) {
      console.error("[EventNexus] Failed to update config.json:", err);
      return interaction.editReply(
        "❌ I couldn't save the default channel (config write failed). Check the logs on Railway."
      );
    }

    console.log("[EventNexus] Default event channel set to:", updated.defaultEventChannelId);

    return interaction.editReply(
      `✅ Default event channel set to ${channel} (\`${channel.id}\`).`
    );
  } catch (err) {
    console.error("[EventNexus] Error in /seteventchannel handler:", err);

    // Best effort to notify the user, but don't crash if this also fails
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(
          "❌ Something went wrong while setting the default channel."
        );
      } else {
        await interaction.reply({
          content: "❌ Something went wrong while setting the default channel.",
          ephemeral: true,
        });
      }
    } catch (e) {
      console.error("[EventNexus] Failed to send error response for /seteventchannel:", e);
    }
  }
}
