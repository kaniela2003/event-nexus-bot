// src/commands/ping.js

import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check if Event Nexus bot is alive.");

export async function execute(interaction) {
  const now = Date.now();
  const reply = await interaction.reply({ content: "Pinging...", fetchReply: true });
  const latency = Date.now() - now;

  await interaction.editReply(`🏓 Pong! Bot latency: \`${latency}ms\``);
}
