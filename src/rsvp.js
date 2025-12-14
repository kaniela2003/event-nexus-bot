// src/rsvp.js
import { EmbedBuilder } from "discord.js";

// eventId -> state
// state = { maxPlayers:number, vip:Set, going:Set, maybe:Set, waitlist:Array<string> }
const events = new Map();

export function registerEvent(eventId, maxPlayers) {
  const mp = Number(maxPlayers);
  if (!events.has(eventId)) {
    events.set(eventId, {
      maxPlayers: Number.isFinite(mp) && mp > 0 ? mp : 0,
      vip: new Set(),
      going: new Set(),
      maybe: new Set(),
      waitlist: [],
    });
  } else {
    const s = events.get(eventId);
    if (Number.isFinite(mp) && mp > 0) s.maxPlayers = mp;
  }
  return events.get(eventId);
}

function removeFromWaitlist(state, userId) {
  const next = [];
  let removed = false;
  for (const id of state.waitlist) {
    if (id === userId && !removed) removed = true;
    else next.push(id);
  }
  state.waitlist = next;
  return removed;
}

function counts(state) {
  const spotsUsed = state.vip.size + state.going.size;
  return {
    spotsUsed,
    maxPlayers: state.maxPlayers,
    waitlist: state.waitlist.length,
    vip: state.vip.size,
    going: state.going.size,
    maybe: state.maybe.size,
  };
}

function fmtSet(set) {
  const arr = [...set];
  return arr.length ? arr.map(id => `<@${id}>`).join("\n") : "—";
}

function fmtWaitlist(list) {
  return list.length ? list.map((id, i) => `${i + 1}. <@${id}>`).join("\n") : "—";
}

function rebuildEmbed(msg, state) {
  const old = msg.embeds?.[0];
  const base = old ? EmbedBuilder.from(old) : new EmbedBuilder().setTitle("Event").setDescription(" ");

  // Keep the existing Time field if present
  const oldTime = (old?.fields || []).find(f => f?.name === "Time");

  const c = counts(state);
  const spotLabel =
    state.maxPlayers > 0 ? `Spots (${c.spotsUsed}/${c.maxPlayers})` : `Spots (${c.spotsUsed})`;

  const fields = [];
  if (oldTime) fields.push(oldTime);

  fields.push(
    { name: spotLabel, value: " ", inline: false },
    { name: `VIP (${c.vip})`, value: fmtSet(state.vip), inline: false },
    { name: `Going (${c.going})`, value: fmtSet(state.going), inline: false },
    { name: `Maybe (${c.maybe})`, value: fmtSet(state.maybe), inline: false },
    { name: `Waitlist (${c.waitlist})`, value: fmtWaitlist(state.waitlist), inline: false },
  );

  base.setFields(fields);
  base.setFooter({ text: "Event Nexus" });
  base.setTimestamp(new Date());

  return base;
}

export async function handleRsvpButton(interaction) {
  if (!interaction.isButton()) return;

  // customId format: rsvp:<action>:<eventId>
  const parts = String(interaction.customId || "").split(":");
  if (parts.length < 3) return;

  const [prefix, action, eventId] = parts;
  if (prefix !== "rsvp" || !eventId) return;

  const state = events.get(eventId);
  if (!state) {
    // Must respond somehow or Discord shows "Interaction Failed"
    await interaction.reply({ content: "❌ This event is no longer active.", ephemeral: true }).catch(() => {});
    return;
  }

  // Acknowledge immediately (no visible reply)
  await interaction.deferUpdate().catch(() => {});

  const userId = interaction.user.id;

  // Always remove them from all buckets first
  state.vip.delete(userId);
  state.going.delete(userId);
  state.maybe.delete(userId);
  removeFromWaitlist(state, userId);

  const max = state.maxPlayers;
  const used = state.vip.size + state.going.size;

  if (action === "vip") {
    if (max > 0 && used >= max) state.waitlist.push(userId);
    else state.vip.add(userId);
  }

  if (action === "yes") {
    const nowUsed = state.vip.size + state.going.size;
    if (max > 0 && nowUsed >= max) state.waitlist.push(userId);
    else state.going.add(userId);
  }

  if (action === "maybe") {
    state.maybe.add(userId);
  }

  if (action === "no") {
    // nothing (they were already removed)
  }

  if (action === "cancel") {
    // If a spot opened, promote from waitlist into "going" (VIP can be handled later if you want)
    if (state.waitlist.length > 0) {
      const nextId = state.waitlist.shift();
      if (max > 0 && (state.vip.size + state.going.size) < max) state.going.add(nextId);
      else state.waitlist.unshift(nextId);
    }
  }

  const embed = rebuildEmbed(interaction.message, state);
  await interaction.message.edit({ embeds: [embed] }).catch(() => {});
}
