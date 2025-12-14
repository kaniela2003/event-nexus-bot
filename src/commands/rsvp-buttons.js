import { EmbedBuilder } from "discord.js";

// eventId -> { maxSlots:number, confirmed:Set<string>, waitlist:string[] }
const events = new Map();

export function registerEvent(eventId, maxSlots) {
  if (!eventId) return;
  const slots = Number(maxSlots);
  events.set(eventId, {
    maxSlots: Number.isFinite(slots) && slots > 0 ? slots : 30,
    confirmed: new Set(),
    waitlist: [],
  });
}

function ensureState(eventId) {
  if (!events.has(eventId)) registerEvent(eventId, 30);
  return events.get(eventId);
}

function rebuildEmbed(originalEmbed, state) {
  const embed = originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder();

  const confirmedList =
    [...state.confirmed].map((id) => `<@${id}>`).join("\n") || "—";

  const waitlistList =
    state.waitlist.map((id, idx) => `${idx + 1}. <@${id}>`).join("\n") || "—";

  // Overwrite the RSVP fields consistently
  embed.setFields([
    { name: `Spots (${state.confirmed.size}/${state.maxSlots})`, value: confirmedList, inline: false },
    { name: `Waitlist (${state.waitlist.length})`, value: waitlistList, inline: false },
  ]);

  return embed;
}

export async function handleEventButton(interaction) {
  if (!interaction?.isButton?.()) return;

  const cid = String(interaction.customId || "");

  // Support both formats:
  //   rsvp_join:<eventId>
  //   rsvp_cancel:<eventId>
  // And also allow:
  //   rsvp:yes:<eventId> / rsvp:cancel:<eventId>
  let action = null;
  let eventId = null;

  if (cid.startsWith("rsvp_join:")) {
    action = "yes";
    eventId = cid.split(":")[1] || null;
  } else if (cid.startsWith("rsvp_cancel:")) {
    action = "cancel";
    eventId = cid.split(":")[1] || null;
  } else if (cid.startsWith("rsvp:")) {
    const parts = cid.split(":"); // rsvp:action:eventId
    action = parts[1] || null;
    eventId = parts[2] || null;
  } else {
    return; // not ours
  }

  if (!eventId) {
    return await interaction.reply({ content: "⚠️ Missing event id.", ephemeral: true });
  }

  // Make sure we always respond (no timeouts)
  try {
    const state = ensureState(eventId);
    if (!state) {
      return await interaction.reply({ content: "❌ This event is no longer active.", ephemeral: true });
    }

    const userId = interaction.user.id;

    // Remove user from both lists first (clean slate)
    const wasConfirmed = state.confirmed.delete(userId);
    state.waitlist = state.waitlist.filter((id) => id !== userId);

    if (action === "yes" || action === "join") {
      if (state.confirmed.size < state.maxSlots) {
        state.confirmed.add(userId);
      } else {
        state.waitlist.push(userId);
      }
    } else if (action === "no") {
      // do nothing (already removed)
    } else if (action === "cancel") {
      // If they cancelled and they WERE confirmed, promote next from waitlist
      if (wasConfirmed && state.waitlist.length > 0) {
        const nextId = state.waitlist.shift();
        state.confirmed.add(nextId);
      }
    }

    const original = interaction.message?.embeds?.[0] || null;
    const embed = rebuildEmbed(original, state);

    return await interaction.update({
      embeds: [embed],
      components: interaction.message.components,
    });
  } catch (e) {
    console.error("RSVP button error:", e);
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({ content: "⚠️ RSVP failed. Try again.", ephemeral: true });
      }
      if (interaction.deferred && !interaction.replied) {
        return await interaction.editReply("⚠️ RSVP failed. Try again.");
      }
    } catch {}
  }
}

// Keep this export because src/index.js calls it
export async function handleModal(interaction) {
  if (!interaction?.isModalSubmit?.()) return;
  // Not used in the current RSVP flow; respond anyway so Discord never times out
  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply({ content: "✅ Received.", ephemeral: true });
  }
}
