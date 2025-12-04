// src/commands/create-event.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

const { createEvent, getGuildSettings } = require('../utils/api');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-event')
    .setDescription('Create a new event and post it into this server’s Event Hub.')
    .addStringOption(option =>
      option
        .setName('event_id')
        .setDescription('Unique ID for this event (e.g. heist-2025-12-10a).')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Event name / title.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Start date (YYYY-MM-DD).')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Start time (HH:MM, 24-hour format, UTC).')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('max_slots')
        .setDescription('Maximum number of confirmed players.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Short description of the event.')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const eventId = interaction.options.getString('event_id');
    const name = interaction.options.getString('name');
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const maxSlots = interaction.options.getInteger('max_slots');
    const description =
      interaction.options.getString('description') || 'No description provided.';

    await interaction.deferReply({ ephemeral: true });

    // Validate formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return interaction.editReply('❌ Invalid date format. Use `YYYY-MM-DD`.');
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
      return interaction.editReply('❌ Invalid time format. Use `HH:MM` (24-hour).');
    }

    try {
      // Convert to ISO timestamp (assuming UTC)
      const startsAtIso = new Date(`${date}T${time}:00Z`).toISOString();
      const startsAtTs = Math.floor(new Date(startsAtIso).getTime() / 1000);

      // Event payload for Supabase
      const eventPayload = {
        id: eventId,
        name,
        description,
        starts_at: startsAtIso,
        ends_at: null,
        max_slots: maxSlots,
        status: 'scheduled',
        host_discord_id: interaction.user.id,
      };

      // Create event in Supabase
      const created = await createEvent(eventPayload);

      // Fetch guild-specific Event Hub settings
      const guild = interaction.guild;
      const settings = await getGuildSettings(guild.id);

      let hubMessageInfo = '';

      if (!settings || !settings.event_hub_channel_id) {
        hubMessageInfo =
          '\n⚠️ No Event Hub is set for this server. An admin must run `/setup-hub`.';
      } else {
        try {
          const hubChannel = await interaction.client.channels.fetch(
            settings.event_hub_channel_id
          );

          if (!hubChannel || !hubChannel.isTextBased()) {
            hubMessageInfo =
              '\n⚠️ The configured Event Hub is invalid. Admin should re-run `/setup-hub`.';
          } else {
            // Build embed
            const embed = new EmbedBuilder()
              .setTitle(`📅 ${created.name}`)
              .setDescription(description)
              .addFields(
                { name: 'Event ID', value: `\`${created.id}\``, inline: true },
                {
                  name: 'Host',
                  value: `<@${created.host_discord_id}>`,
                  inline: true,
                },
                {
                  name: 'Start Time',
                  value: `<t:${startsAtTs}:F>`,
                  inline: false,
                },
                {
                  name: 'Slots',
                  value: `**${created.max_slots}** players`,
                  inline: true,
                },
                {
                  name: 'How to RSVP',
                  value: `Use:\n\`/event-rsvp event_id: ${created.id}\``,
                  inline: false,
                }
              )
              .setFooter({ text: 'EventNexus • Supabase-backed events' })
              .setTimestamp(new Date(created.starts_at));

            await hubChannel.send({ embeds: [embed] });
            hubMessageInfo = `\n📨 Event posted in <#${settings.event_hub_channel_id}>.`;
          }
        } catch (err) {
          console.error('Event Hub post failed:', err);
          hubMessageInfo =
            '\n⚠️ Event created, but I could not post to the Event Hub. Check my permissions.';
        }
      }

      // Final admin confirmation
      await interaction.editReply(
        [
          '✅ **Event created in EventNexus!**',
          '',
          `ID: \`${created.id}\``,
          `Name: **${created.name}**`,
          `Starts At (UTC): \`${created.starts_at}\``,
          `Max Slots: **${created.max_slots}**`,
          hubMessageInfo,
        ].join('\n')
      );
    } catch (err) {
      console.error('create-event error:', err.message || err);

      let msg = '❌ Failed to create event.';
      if (err.response?.data) {
        msg += ` Supabase says: \`${JSON.stringify(err.response.data)}\``;
      }

      await interaction.editReply(msg);
    }
  },
};
