// src/commands/create-event.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";

const apiBase = process.env.NEXUS_API_URL || null;
const apiKey = process.env.BASE44_API_KEY || null;

// In-memory RSVP state, keyed by Discord message ID
// This resets if the bot restarts.
const eventState = new Map();

/**
 * Build the event embed from state.
 */
function buildEventEmbed(state) {
  const yesList = state.yes.length
    ? state.yes.map((id, idx) => `${idx + 1}. <@${id}>`).join("\n")
    : "None";

  const waitList = state.waitlist.length
    ? state.waitlist.map((id, idx) => `${idx + 1}. <@${id}>`).join("\n")
    : "None";

  const noList = state.no.length
    ? state.no.map((id, idx) => `${idx + 1}. <@${id}>`).join("\n")
    : "None";

  return new EmbedBuilder()
    .setTitle(`🎮 ${state.title}`)
    .setDescription(state.description || "No description provided.")
    .addFields(
      { name: "🕒 Time", value: state.timeText, inline: false },
      { name: "🎯 Max slots", value: String(state.maxPlayers), inline: true },
      { name: `✅ Yes (${state.yes.length}/${state.maxPlayers})`, value: yesList, inline: false },
      { name: `📥 Waitlist (${state.waitlist.length})`, value: waitList, inline: false },
      { name: `❌ No (${state.no.length})`, value: noList, inline: false }
    )
    .setFooter({ text: `Created by ${state.createdByName}` })
    .setTimestamp();
}

/**
 * Build Yes / No / Cancel buttons.
 */
function buildEventButtons(eventKey) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event:${eventKey}:yes`)
      .setLabel("✅ Yes")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`event:${eventKey}:no`)
      .setLabel("❌ No")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId(`event:${eventKey}:cancel`)
      .setLabel("🗑 Cancel RSVP")
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Slash command definition
 */
export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Event title").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("time").setDescription("Event time (e.g. 2025-12-05 20:00 PST)").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("description").setDescription("Short description").setRequired(false)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("max")
      .setDescription("Max players (default 30)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100)
  );

/**
 * Slash command handler
 */
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("title", true);
  const timeText = interaction.options.getString("time", true);
  const description = interaction.options.getString("description") || "";
  const maxPlayers = interaction.options.getInteger("max") ?? 30;

  // Sync to backend (optional)
  let backendId = null;

  if (apiBase) {
    try {
      const payload = {
        title,
        time: timeText,
        description,
        maxPlayers,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        createdBy: interaction.user.id,
      };

      const res = await axios.post(`${apiBase}/events`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
      });

      backendId = res.data?.id || null;
      console.log("Event synced to Nexus API:", backendId);
    } catch (err) {
      console.error("Failed backend sync:", err.message);
    }
  }

  const state = {
    backendId,
    title,
    timeText,
    description,
    maxPlayers,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    createdBy: interaction.user.id,
    createdByName: interaction.user.tag,
    yes: [],
    waitlist: [],
    no: [],
  };

  const eventKey = backendId || `local-${Date.now()}`;
  const embed = buildEventEmbed(state);
  const row = buildEventButtons(eventKey);

  const message = await interaction.followUp({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  state.messageId = message.id;
  state.eventKey = eventKey;

  eventState.set(message.id, state);
  console.log("Event tracked:", message.id);
}

/**
 * Handle RSVP buttons: Yes / No / Cancel
 */
export async function handleEventButton(interaction) {
  const { customId, message, user } = interaction;
  const [prefix, eventKey, action] = customId.split(":");

  if (prefix !== "event") return;

  const messageId = message.id;
  const state = eventState.get(messageId);

  if (!state) {
    return interaction.reply({
      content: "⚠ RSVP tracking reset. Event must be recreated.",
      ephemeral: true,
    });
  }

  const userId = user.id;

  // Remove user from all lists first
  state.yes = state.yes.filter((id) => id !== userId);
  state.no = state.no.filter((id) => id !== userId);
  state.waitlist = state.waitlist.filter((id) => id !== userId);

  if (action === "yes") {
    if (state.yes.length < state.maxPlayers) {
      state.yes.push(userId);
    } else {
      state.waitlist.push(userId);
    }
  }

  if (action === "no") {
    state.no.push(userId);
    while (state.yes.length < state.maxPlayers && state.waitlist.length > 0) {
      const promoted = state.waitlist.shift();
      state.yes.push(promoted);
    }
  }

  if (action === "cancel") {
    while (state.yes.length < state.maxPlayers && state.waitlist.length > 0) {
      const promoted = state.waitlist.shift();
      state.yes.push(promoted);
    }
  }

  const updatedEmbed = buildEventEmbed(state);

  await interaction.update({
    embeds: [updatedEmbed],
    components: message.components,
  });

  eventState.set(messageId, state);
}
