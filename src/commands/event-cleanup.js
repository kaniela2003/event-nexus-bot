// src/commands/event-cleanup.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-cleanup')
    .setDescription('Delete an event category and all its channels.')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Exact name of the event category to delete.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const categoryName = interaction.options.getString('category');
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const category = guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && ch.name === categoryName
      );

      if (!category) {
        await interaction.editReply({
          content: `No category found with the name **${categoryName}**.`,
        });
        return;
      }

      const children = guild.channels.cache.filter(
        ch => ch.parentId === category.id
      );

      let deletedCount = 0;

      for (const [, channel] of children) {
        try {
          await channel.delete(`Event cleanup for category "${categoryName}"`);
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete channel ${channel.name}`, err);
        }
      }

      try {
        await category.delete(`Event cleanup for category "${categoryName}"`);
      } catch (err) {
        console.error(`Failed to delete category ${categoryName}`, err);
      }

      await interaction.editReply({
        content: `🧹 Cleaned up category **${categoryName}** and deleted **${deletedCount}** channels.`,
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: 'Something went wrong during cleanup. Check my Manage Channels permission.',
      });
    }
  },
};
