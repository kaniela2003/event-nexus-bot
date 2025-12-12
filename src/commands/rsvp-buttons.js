import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from "discord.js";
import { rsvpStore, buildRsvpRow } from "../syncHub.js";
import { ensureState, upsertUser, removeUser, isIn, promoteIfPossible, counts, formatRoster } from "../utils/rsvpEngine.js";
import { postRsvpToApp } from "../utils/nexusApi.js";

const STAFF_LOG_CHANNEL = process.env.STAFF_LOG_CHANNEL || null;

export async function handleEventButton(interaction) {
  const [kind, eventId] = interaction.customId.split(":");
  if (!eventId) return;

  const state = ensureState(rsvpStore, eventId, null);

  // JOIN -> ask PSN/IG via modal
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

  // CANCEL
  if (kind === "rsvp_cancel") {
    const userId = interaction.user.id;

    const wasGoing = isIn(state.going, userId);
    const wasWait = isIn(state.waitlist, userId);

    removeUser(state.going, userId);
    removeUser(state.waitlist, userId);

    const promoted = promoteIfPossible(state);

    await updateEventMessage(interaction.client, state, eventId);
    await updateStaffRoster(interaction.client, state, eventId);

    // Sync to app (best effort)
    await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "cancel" });

    const msg =
      wasGoing ? `❌ Removed you from RSVP.${promoted ? ` ✅ Promoted <@${promoted.userId}> from waitlist.` : ""}` :
      wasWait ? `❌ Removed you from waitlist.` :
      `You were not on the RSVP list.`;

    return await interaction.reply({ content: msg, ephemeral: true });
  }
}

export async function handleModal(interaction) {
  const [kind, eventId] = interaction.customId.split(":");
  if (kind !== "rsvp_modal") return;

  const state = ensureState(rsvpStore, eventId, null);

  const userId = interaction.user.id;
  const psn = interaction.fields.getTextInputValue("psn")?.trim();
  const ig = interaction.fields.getTextInputValue("ig")?.trim();

  const entry = { userId, psn, ig: ig || null };

  // Update details if already present
  if (isIn(state.going, userId)) {
    upsertUser(state.going, entry);
    await updateEventMessage(interaction.client, state, eventId);
    await updateStaffRoster(interaction.client, state, eventId);
    await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "rsvp", psn, ig: ig || null });
    return await interaction.reply({ content: "✅ Updated your RSVP details.", ephemeral: true });
  }

  if (isIn(state.waitlist, userId)) {
    upsertUser(state.waitlist, entry);
    await updateEventMessage(interaction.client, state, eventId);
    await updateStaffRoster(interaction.client, state, eventId);
    await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "waitlist", psn, ig: ig || null });
    return await interaction.reply({ content: "✅ Updated your waitlist details.", ephemeral: true });
  }

  // Add to going if space, else waitlist
  const capped = state.maxPlayers && state.maxPlayers > 0;

  if (!capped || state.going.length < state.maxPlayers) {
    state.going.push(entry);
    await updateEventMessage(interaction.client, state, eventId);
    await updateStaffRoster(interaction.client, state, eventId);
    await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "rsvp", psn, ig: ig || null });
    return await interaction.reply({ content: "✅ You are RSVP’d.", ephemeral: true });
  } else {
    state.waitlist.push(entry);
    await updateEventMessage(interaction.client, state, eventId);
    await updateStaffRoster(interaction.client, state, eventId);
    await postRsvpToApp({ type: "rsvp_update", eventId, userId, status: "waitlist", psn, ig: ig || null });
    return await interaction.reply({ content: "⏳ Event is full — you’ve been added to the waitlist.", ephemeral: true });
  }
}

async function updateEventMessage(client, state, eventId) {
  if (!state.channelId || !state.messageId) return;

  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(state.messageId).catch(() => null);
  if (!msg) return;

  const old = msg.embeds?.[0];
  const title = old?.title || "Event";
  const desc = old?.description || " ";

  const c = counts(state);

  const oldTimeField = (old?.fields || []).find(f => f?.name === "Time");

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .addFields(
      ...(oldTimeField ? [oldTimeField] : []),
      { name: "RSVP", value: state.maxPlayers > 0 ? `${c.going}/${c.maxPlayers}` : `${c.going}`, inline: true },
      { name: "Waitlist", value: `${c.waitlist}`, inline: true }
    )
    .setFooter({ text: "Event Nexus" })
    .setTimestamp();

  const img = old?.image?.url;
  if (img) embed.setImage(img);

  await msg.edit({ embeds: [embed], components: [buildRsvpRow(eventId)] });
}

async function updateStaffRoster(client, state, eventId) {
  const staffChannelId = STAFF_LOG_CHANNEL || state.channelId;
  if (!staffChannelId) return;

  const channel = await client.channels.fetch(staffChannelId).catch(() => null);
  if (!channel) return;

  const roster = formatRoster(state, client);

  const embed = new EmbedBuilder()
    .setTitle(`Staff Roster — ${eventId}`)
    .addFields(
      { name: `Going (${state.going.length})`, value: roster.goingText.slice(0, 3900) || "None" },
      { name: `Waitlist (${state.waitlist.length})`, value: roster.waitText.slice(0, 3900) || "None" }
    )
    .setFooter({ text: "Staff only" })
    .setTimestamp();

  if (state.staffMessageId) {
    const msg = await channel.messages.fetch(state.staffMessageId).catch(() => null);
    if (msg) return await msg.edit({ embeds: [embed] });
  }

  const sent = await channel.send({ embeds: [embed] });
  state.staffMessageId = sent.id;
  state.staffChannelId = staffChannelId;
}
