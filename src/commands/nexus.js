// src/commands/nexus.js

import { SlashCommandBuilder } from "discord.js";
import { getNexusStatus } from "../utils/api.js";

export const data = new SlashCommandBuilder()
  .setName("nexus")
  .setDescription("Check connection to the Event Nexus backend (Base44).");

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const status = await getNexusStatus();

  if (!status.ok) {
    await interaction.editReply(
      `⚠️ Could not reach Nexus backend.\nReason: \`${status.message}\``
    );
    return;
  }

  await interaction.editReply(
    [
      "✅ Nexus backend is reachable.",
      `HTTP status: \`${status.status}\``,
      typeof status.data === "object"
        ? "Response looks like JSON (details hidden)."
        : `Response: \`${String(status.data).slice(0, 150)}\``
    ].join("\n")
  );
}
