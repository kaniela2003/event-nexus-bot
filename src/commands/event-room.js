// src/commands/event-room.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-room')
    .setDescription('Create a temporary category with text and voice channels for an event.')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Event name (used for the category).')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role that should have access (e.g. RSVP role).')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('cleanup')
        .setDescription('Auto-delete the category and its channels in 3 hours? (default: true)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const eventName = interaction.options.getString('name');
    const rsvpRole = interaction.options.getRole('role'); // optional role
    const cleanup = interaction.options.getBoolean('cleanup');
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Base overwrites for the CATEGORY
      const categoryOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];

      if (rsvpRole) {
        categoryOverwrites.push({
          id: rsvpRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.SendMessages,
          ],
        });
      }

      // Create the category
      const category = await guild.channels.create({
        name: eventName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryOverwrites,
      });

      // Text channel overwrites
      const textOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];

      if (rsvpRole) {
        textOverwrites.push({
          id: rsvpRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        });
      }

      // Voice channel overwrites
      const voiceOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
          ],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ];

      if (rsvpRole) {
        voiceOverwrites.push({
          id: rsvpRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        });
      }

      // Create text channel
      const textChannel = await guild.channels.create({
        name: 'event-chat',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: textOverwrites,
      });

      // Create voice channel
      const voiceChannel = await guild.channels.create({
        name: 'Event Voice',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: voiceOverwrites,
      });

      let msg = `Created event room for **${eventName}**.\n- Category: ${category.name}\n- Text: ${textChannel}\n- Voice: ${voiceChannel}`;

      const doCleanup = cleanup !== false; // default true
      if (doCleanup) {
        setTimeout(async () => {
          try {
            await textChannel.delete('Event auto-cleanup');
          } catch {}
          try {
            await voiceChannel.delete('Event auto-cleanup');
          } catch {}
          try {
            await category.delete('Event auto-cleanup');
          } catch {}
        }, 3 * 60 * 60 * 1000); // 3 hours

        msg += `\n\n⏳ These channels will auto-delete in **3 hours**.`;
      }

      if (rsvpRole) {
        msg += `\n\n🎟 Access granted to role: ${rsvpRole}`;
      } else {
        msg += `\n\n(Only you and the bot can see these until we hook in RSVPs.)`;
      }

      await interaction.editReply({ content: msg });
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: 'Something went wrong creating the event room. Check my permissions (Manage Channels).',
      });
    }
  },
};
