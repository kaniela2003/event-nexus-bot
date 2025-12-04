// src/commands/event-rsvp.js
const { SlashCommandBuilder } = require('discord.js');
const { rsvpEvent } = require('../utils/api');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-rsvp')
    .setDescription('RSVP to an event using its ID from the event app.')
    .addStringOption(option =>
      option
        .setName('event_id')
        .setDescription('The event ID from the event planner app.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const eventId = interaction.options.getString('event_id');
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      const payload = {
        discord_id: user.id,
        discord_name: user.username,
      };

      const result = await rsvpEvent(eventId, payload);

      if (result.status === 'confirmed') {
        await interaction.editReply(
          `✅ You are **confirmed** for event \`${eventId}\`.`
        );
      } else if (result.status === 'waitlist') {
        await interaction.editReply(
          `⏳ The event is full. You have been added to the **waitlist** for \`${eventId}\`.`
        );
      } else if (result.status === 'blocked') {
        const reason = result.reason || 'You are not allowed to RSVP for this event.';
        await interaction.editReply(
          `⛔ Your RSVP was **blocked** for event \`${eventId}\`.\nReason: ${reason}`
        );
      } else {
        await interaction.editReply(
          `⚠️ RSVP result for \`${eventId}\` was unclear. Ask an admin to check the logs.`
        );
      }
    } catch (err) {
      console.error('RSVP error:', err.message);
      await interaction.editReply(
        '❌ Something went wrong talking to the event app. Check that the API URL/key are correct and the event exists.'
      );
    }
  },
};
