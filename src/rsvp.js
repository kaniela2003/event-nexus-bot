// src/rsvp.js
import { EmbedBuilder } from "discord.js";

// eventId -> { maxSlots, confirmed:Set<string>, waitlist:string[] }
const events = new Map();

/**
 * Register a new event in memory.
 */
export function registerEvent(eventId, maxSlots) {
  events.set(eventId, {
    maxSlots,
    confirmed: new Set(),
    waitlist: [],
  });
}

/**
 * Core RSVP logic: Yes / No / Cancel + waitlist promotion.
 */
export async function handleRsvpButton(interaction) {
  if (!interaction.isButton()) return;

  const [prefix, action, eventId] = interaction.customId.split(":");
  if (prefix !== "rsvp" || !eventId) return;

  const state = events.get(eventId);
  if (!state) {
    return interaction.reply({
      content: "❌ This event is no longer active.",
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;
  const userMention = `<@${userId}>`;

  // Remove user from both lists up front to keep things clean
  const wasConfirmed = state.confirmed.delete(userId);
  let wasWaiting = false;
  const newWaitlist = [];
  for (const id of state.waitlist) {
    if (id === userId) {
      wasWaiting = true;
    } else {
      newWaitlist.push(id);
    }
  }
  state.waitlist = newWaitlist;

  if (action === "yes") {
    // If they click "Yes"
    if (state.confirmed.size < state.maxSlots) {
      state.confirmed.add(userId);
    } else {
      // Event full → add to waitlist
      state.waitlist.push(userId);
    }
  } else if (action === "no") {
    // "No" = remove them completely; nothing else to do.
  } else if (action === "cancel") {
    // If they cancelled and they WERE confirmed, promote next from waitlist
    if (wasConfirmed && state.waitlist.length > 0) {
      const nextId = state.waitlist.shift();
      state.confirmed.add(nextId);
    }
  }

  // Rebuild embed with updated lists
  const original = interaction.message.embeds[0];
  const embed = EmbedBuilder.from(original);

  const confirmedList =
    [...state.confirmed].map((id) => `<@${id}>`).join("\n") || "—";

  const waitlistList =
    state.waitlist.map((id, idx) => `${idx + 1}. <@${id}>`).join("\n") || "—";

  embed.setFields([
    {
      name: `Spots (${state.confirmed.size}/${state.maxSlots})`,
      value: confirmedList,
      inline: false,
    },
    {
      name: `Waitlist (${state.waitlist.length})`,
      value: waitlistList,
      inline: false,
    },
  ]);

  await interaction.update({
    embeds: [embed],
    components: interaction.message.components,
  });
}
