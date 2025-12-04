// src/commands/event-room-sync.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { getEvent, getEventAttendees } = require('../utils/api');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-room-sync')
    .setDescription('Create an event Discord room based on RSVPs from the event app.')
    .addStringOption(option =>
      option
        .setName('event_id')
        .setDescription('The event ID from the event planner app.')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('cleanup')
        .setDescription('Auto-delete after 3 hours? (default: true)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const eventId = interaction.options.getString('event_id');
    const cleanup = interaction.options.getBoolean('cleanup');
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
      // 1) Get event details
      const event = await getEvent(eventId); 
      const eventName = event.name || `Event ${eventId}`;

      // 2) Get attendees from app
      const data = await getEventAttendees(eventId);
      const attendees = data.attendees || [];

      // Only "main" confirmed attendees get full access
      const confirmed = attendees.filter(a => a.state === 'main');

      const allowedIds = new Set();
      allowedIds.add(interaction.user.id);          // command user
      allowedIds.add(interaction.client.user.id);   // bot itself

      for (const a of confirmed) {
        if (a.discord_id) {
          allowedIds.add(a.discord_id);
        }
      }

      // Base overwrites (deny @everyone)
      const baseDenyEveryone = {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      };

      const categoryOverwrites = [baseDenyEveryone];
      const textOverwrites = [baseDenyEveryone];
      const voiceOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
          ],
        },
      ];

      for (const id of allowedIds) {
        categoryOverwrites.push({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.SendMessages,
          ],
        });

        textOverwrites.push({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        });

        voiceOverwrites.push({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        });
      }

      // 3) Create category
      const category = await guild.channels.create({
        name: eventName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryOverwrites,
      });

      // 4) Create channels under it
      const textChannel = await guild.channels.create({
        name: 'event-chat',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: textOverwrites,
      });

      const voiceChannel = await guild.channels.create({
        name: 'Event Voice',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: voiceOverwrites,
      });

      let msg = `Created synced event room for **${eventName}** (${eventId}).\n` +
        `- Category: ${category.name}\n` +
        `- Text: ${textChannel}\n` +
        `- Voice: ${voiceChannel}\n` +
        `- Confirmed attendees with access: **${confirmed.length}**`;

      const doCleanup = cleanup !== false; // default true
      if (doCleanup) {
        setTimeout(async () => {
          try { await textChannel.delete('Event auto-cleanup'); } catch {}
          try { await voiceChannel.delete('Event auto-cleanup'); } catch {}
          try { await category.delete('Event auto-cleanup'); } catch {}
        }, 3 * 60 * 60 * 1000); // 3 hours
        msg += `\n\n⏳ These channels will auto-delete in **3 hours**.`;
      }

      await interaction.editReply({ content: msg });
    } catch (err) {
      console.error('event-room-sync error:', err.message);
      await interaction.editReply(
        '❌ Failed to sync with the event app. Check the API URL/key, event ID, and backend endpoints.'
      );
    }
  },
};
