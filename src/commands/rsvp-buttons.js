import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { rsvpStore, buildRsvpRow } from "../syncHub.js";
import { ensureState, upsertUser, removeUser, isIn, promoteIfPossible, counts } from "../utils/rsvpEngine.js";
import { postRsvpToApp } from "../utils/nexusApi.js";

const STAFF_LOG_CHANNEL = process.env.STAFF_LOG_CHANNEL || null;

export async function handleEventButton(interaction) {
  try {
    const parts = String(interaction.customId || "").split(":");
    const kind = parts[0];
    const eventId = parts[1];

    if (!eventId) {
      return await interaction.reply({ content: "⚠️ Missing event id.", ephemeral: true });
    }

    const state = ensureState(rsvpStore, eventId, null);

    // RSVP -> show modal FAST (no defer before showModal)
    if (kind === "rsvp_join") {
      const modal = new ModalBuilder()
        .setCustomId(`rsvp_modal:${eventId}`)
        .setTitle("RSVP Details");

      const psn = new TextInputBuilder()
        .setCustomId("psn")
        .setLabel("PSN (required)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const ig = new TextInputBuilder()
        .setCustomId("ig")
        .setLabel("Instagram (optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(psn),
        new ActionRowBuilder().addComponents(ig)
      );

      return await interaction.showModal(modal);
    }

    // Cancel -> defer immediately so Discord never times out
    if (kind === "rsvp_cancel") {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;

      const wasGoing = isIn(state.going, userId);
      const wasWait = isIn(state.waitlist, userId);

      removeUser(state.going, userId);
      removeUser(state.waitlist, userId);

      const promoted = promoteIfPossible(state);

      // Update message counts (edit fast)
      await updateEventMessage(interaction, state, eventId).catch(() => {});
      await updateStaffRoster(interaction, state, eventId).catch(() => {});

      // Sync to app (best effort)
      await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "cancel" }).catch(() => {});

      const msg =
        wasGoing ? `❌ Removed you from RSVP.${promoted ? ` ✅ Promoted <@${promoted.userId}> from waitlist.` : ""}` :
        wasWait ? `❌ Removed you from waitlist.` :
        `You were not on the RSVP list.`;

      return await interaction.editReply(msg);
    }

    // Unknown button
    return await interaction.reply({ content: "⚠️ Unknown action.", ephemeral: true });

  } catch (e) {
    console.error("❌ handleEventButton error:", e);
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({ content: "⚠️ Interaction failed. Try again.", ephemeral: true });
      }
      if (interaction.deferred && !interaction.replied) {
        return await interaction.editReply("⚠️ Interaction failed. Try again.");
      }
    } catch {}
  }
}

export async function handleModal(interaction) {
  try {
    const parts = String(interaction.customId || "").split(":");
    const kind = parts[0];
    const eventId = parts[1];

    if (kind !== "rsvp_modal" || !eventId) return;

    // Defer instantly to avoid 3s timeout while we update stuff
    await interaction.deferReply({ ephemeral: true });

    const state = ensureState(rsvpStore, eventId, null);

    const userId = interaction.user.id;
    const psn = interaction.fields.getTextInputValue("psn")?.trim();
    const ig = interaction.fields.getTextInputValue("ig")?.trim();

    if (!psn) return await interaction.editReply("⚠️ PSN is required.");

    const entry = { userId, psn, ig: ig || null };

    // If already in lists, update details
    if (isIn(state.going, userId)) {
      upsertUser(state.going, entry);
      await updateEventMessage(interaction, state, eventId).catch(() => {});
      await updateStaffRoster(interaction, state, eventId).catch(() => {});
      await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "rsvp", psn, ig: ig || null }).catch(() => {});
      return await interaction.editReply("✅ Updated your RSVP details.");
    }

    if (isIn(state.waitlist, userId)) {
      upsertUser(state.waitlist, entry);
      await updateEventMessage(interaction, state, eventId).catch(() => {});
      await updateStaffRoster(interaction, state, eventId).catch(() => {});
      await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "waitlist", psn, ig: ig || null }).catch(() => {});
      return await interaction.editReply("✅ Updated your waitlist details.");
    }

    // Add to going if space, else waitlist
    const capped = state.maxPlayers && state.maxPlayers > 0;

    if (!capped || state.going.length < state.maxPlayers) {
      state.going.push(entry);
      await updateEventMessage(interaction, state, eventId).catch(() => {});
      await updateStaffRoster(interaction, state, eventId).catch(() => {});
      await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "rsvp", psn, ig: ig || null }).catch(() => {});
      return await interaction.editReply("✅ You are RSVP’d.");
    } else {
      state.waitlist.push(entry);
      await updateEventMessage(interaction, state, eventId).catch(() => {});
      await updateStaffRoster(interaction, state, eventId).catch(() => {});
      await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "waitlist", psn, ig: ig || null }).catch(() => {});
      return await interaction.editReply("⏳ Event is full — you’ve been added to the waitlist.");
    }

  } catch (e) {
    console.error("❌ handleModal error:", e);
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({ content: "⚠️ Interaction failed. Try again.", ephemeral: true });
      }
      if (interaction.deferred && !interaction.replied) {
        return await interaction.editReply("⚠️ Interaction failed. Try again.");
      }
    } catch {}
  }
}

async function updateEventMessage(interaction, state, eventId) {
  if (!state.channelId || !state.messageId) return;

  const channel = await interaction.client.channels.fetch(state.channelId).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(state.messageId).catch(() => null);
  if (!msg) return;

  const old = msg.embeds?.[0];
  const title = old?.title || "Event";
  const desc = old?.description || " ";

  const c = counts(state);
  const oldTimeField = (old?.fields || []).find(f => f?.name === "Time");

  // Rebuild embed quickly
  const embed = {
    title,
    description: desc,
    fields: [
      ...(oldTimeField ? [oldTimeField] : []),
      { name: "RSVP", value: state.maxPlayers > 0 ? `${c.going}/${c.maxPlayers}` : `${c.going}`, inline: true },
      { name: "Waitlist", value: `${c.waitlist}`, inline: true },
    ],
    footer: { text: "Event Nexus" },
    timestamp: new Date().toISOString(),
  };

  const img = old?.image?.url;
  if (img) embed.image = { url: img };

  await msg.edit({ embeds: [embed], components: [buildRsvpRow(eventId)] });
}

async function updateStaffRoster(interaction, state, eventId) {
  const staffChannelId = STAFF_LOG_CHANNEL || state.channelId;
  if (!staffChannelId) return;

  const channel = await interaction.client.channels.fetch(staffChannelId).catch(() => null);
  if (!channel) return;

  // Minimal staff log for now (we’ll make it role-private by channel perms)
  const going = state.going.map(x => `<@${x.userId}> (PSN: ${x.psn}${x.ig ? ` | IG: ${x.ig}` : ""})`).join("\n") || "None";
  const wait = state.waitlist.map(x => `<@${x.userId}> (PSN: ${x.psn}${x.ig ? ` | IG: ${x.ig}` : ""})`).join("\n") || "None";

  const embed = {
    title: `Staff Roster — ${eventId}`,
    fields: [
      { name: `Going (${state.going.length})`, value: going.slice(0, 3900) },
      { name: `Waitlist (${state.waitlist.length})`, value: wait.slice(0, 3900) },
    ],
    footer: { text: "Staff only (lock this channel to staff)" },
    timestamp: new Date().toISOString(),
  };

  if (state.staffMessageId) {
    const msg = await channel.messages.fetch(state.staffMessageId).catch(() => null);
    if (msg) return await msg.edit({ embeds: [embed] });
  }

  const sent = await channel.send({ embeds: [embed] });
  state.staffMessageId = sent.id;
  state.staffChannelId = staffChannelId;
}
