import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { setConfig } from "../utils/config.js";

export const data = new SlashCommandBuilder()
  .setName("seteventchannel")
  .setDescription("Set the default channel for Event Nexus event announcements.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel where Event Nexus will post events.")
      .setRequired(true)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Don't throw if it's missing – handle it ourselves
    const channel = interaction.options.getChannel("channel", false);

    if (!channel) {
      return interaction.editReply(
        "❌ You must choose a channel when using `/seteventchannel`.\n" +
        "Try again and pick a text channel from the menu."
      );
    }

    if (!channel.isTextBased()) {
      return interaction.editReply(
        "❌ That channel cannot receive event posts. Choose a text or announcement channel."
      );
    }

    const updated = setConfig({ defaultEventChannelId: channel.id });
    console.log("[EventNexus] Default event channel set to:", updated.defaultEventChannelId);

    return interaction.editReply(
      `✅ Default event channel set to ${channel} (\`${channel.id}\`).`
    );
  } catch (err) {
    console.error("[EventNexus] Error in /seteventchannel:", err);

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
    } catch (replyErr) {
      console.error(
        "[EventNexus] Failed to send error response for /seteventchannel:",
        replyErr
      );
    }
  }
}
