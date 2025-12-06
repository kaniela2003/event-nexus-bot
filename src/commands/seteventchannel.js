// src/commands/seteventchannel.js
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { setConfig } from "../utils/config.js";

export const data = new SlashCommandBuilder()
  .setName("seteventchannel")
  .setDescription("Set the default channel for Event Nexus event announcements.")
  .setDefaultSubject("SetEventChannel")
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel where Event Nexus will post events.")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interactor) {
  try {
    await interactor.deferReply({ ephemeral: true });

    const chosenChannel = interactor.options.getChannel("channel", true);

    if (!chosenChannel || !chosenChannel.isTextBased()) {
      return interactor.editReply(
        "❌ That channel cannot receive event posts. Choose a text or announcement channel."
      );
    }

    const updated = setConfig({ defaultEventChannelId: chosenChannel.id });
    console.log("[EventNexus] Default event channel set to:", updated.defaultEventChannelId);

    return interactor.editReply(
      `✅ Default event channel set to ${chosenChannel} (\`${chosenChannel.id}\`).`
    );
  } catch (err) {
    console.error("[EventNexus] Error in /seteventchannel handler:", err);

    try {
      if (interactor.deferred || interactor.replied) {
        await interactor.editReply(
          "❌ Something went wrong while setting the default channel."
        );
      } else {
        await interactor.reply({
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
