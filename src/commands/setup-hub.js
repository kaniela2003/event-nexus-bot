// src/commands/setup-hub.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { upsertGuildSettings } = require('../utils/api');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-hub')
    .setDescription('Set this server’s Event Hub channel for event posts.')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to use as the Event Hub for this server.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    if (!channel.isTextBased()) {
      await interaction.reply({
        content: '❌ Please select a text channel for the Event Hub.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const saved = await upsertGuildSettings({
        guild_id: guild.id,
        guild_name: guild.name,
        event_hub_channel_id: channel.id,
      });

      await interaction.editReply(
        [
          '✅ Event Hub configured for this server.',
          '',
          `Server: **${guild.name}** (\`${guild.id}\`)`,
          `Event Hub channel: ${channel}`,
        ].join('\n')
      );
    } catch (err) {
      console.error('setup-hub error:', err);
      await interaction.editReply('❌ Failed to save Event Hub settings. Check Supabase and bot logs.');
    }
  },
};
