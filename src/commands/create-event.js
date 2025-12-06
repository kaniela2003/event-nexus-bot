// src/commands/create-event.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";
import { getConfig } from "../utils/config.js";

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
      {
        name: `✅ Yes (${state.yes.length}/${state.maxPlayers})`,
        value: yesList,
        inline: false,
      },
      {
        name: `📥 Waitlist (${state.waitlist.length})`,
        value: waitList,
        inline: false,
      },
      {
        name: `❌ No (${state.no.length})`,
        value: noList,
        inline: false,
      }
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
 * NOTE: the option is called "capacity" here.
 */
export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event.")
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Event title").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("time")
      .setDescription("Event time (e.g. 2025-12-05 20:00 PST)")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription("Short description")
      .setRequired(false)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("capacity")
      .setDescription("Max players (default 30)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100)
  );

/**
 * /createevent handler
 */
export async function execute(interaction) {
  // Private receipt to you
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("title", true);
  const timeText = interaction.options.getString("time", true);
  const description = interaction.options.getString("description") || "";
  const maxPlayers = interaction.options.getInteger("capacity") ?? 30;

  // Decide which channel to post in:
  // 1) defaultEventChannelId from config.json if valid
  // 2) else the channel you ran the command in
  const cfg = getConfig();
  let targetChannel = interaction.channel;

  if (cfg.defaultEventChannelId) {
    const candidate = interaction.client.channels.cache.get(
      cfg.defaultEventChannelId
    );
    if (candidate && candidate.isTextBased()) {
      targetChannel = candidate;
    }
  }

  // Sync to backend (Base44 / Event Nexus)
  let backendId = null;
  let backendError = null;

  if (!apiBase) {
    console.warn("NEXUS_API_URL not set; skipping backend event sync.");
  } else {
    try {
      const payload = {
        title,
        time: timeText,
        description,
        maxPlayers,
        guildId: interaction.guildId,
        channelId: targetChannel.id,
        createdBy: interaction.user.id,
      };

      const res = await axios.post(`${apiBase}/events`, payload, {
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
      });

      backendId = res.data?.id || null;
      console.log("✅ Event synced to Nexus API:", backendId);
    } catch (err) {
      const backend = err.response?.data;
      backendError =
        backend?.error ||
        backend?.message ||
        (typeof backend === "string" ? backend : null) ||
        err.message;
      console.error("❌ Failed to sync event to Nexus API:", backend || err);
    }
  }

  // Local RSVP state
  const state = {
    backendId,
    title,
    timeText,
    description,
    maxPlayers,
    guildId: interaction.guildId,
    channelId: targetChannel.id,
    createdBy: interaction.user.id,
    createdByName: interaction.user.tag,
    yes: [],
    waitlist: [],
    no: [],
  };

  const eventKey = backendId || `local-${Date.now()}`;

  const embed = buildEventEmbed(state);
  const row = buildEventButtons(eventKey);

  // 🔓 Public message in the event channel (NOT ephemeral)
  const publicMessage = await targetChannel.send({
    embeds: [embed],
    components: [row],
  });

  state.messageId = publicMessage.id;
  state.eventKey = eventKey;
  eventState.set(publicMessage.id, state);
  console.log("📌 Event tracked with message ID:", publicMessage.id);

  let replyText = `✅ Event created and posted in ${targetChannel}.\n(${publicMessage.url})`;
  if (backendError) {
    replyText += `\n⚠ But I couldn't sync it to Event Nexus: ${backendError}`;
  }

  await interaction.editReply({
    content: replyText,
  });
}

/**
 * Handle RSVP buttons: Yes / No / Cancel
 * (wired from index.js via handleEventButton)
 */
export async function handleEventButton(interaction) {
  const { customId, message, user } = interaction;
  const [prefix, eventKey, action] = customId.split(":");

  if (prefix !== "event") return;

  const messageId = message.id;
  const state = eventState.get(messageId);

  if (!state || state.eventKey !== eventKey) {
    return interaction.reply({
      content:
        "⚠ RSVP tracking for this event was reset. Ask staff to recreate the event.",
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
  } else if (action === "no") {
    state.no.push(userId);
    // Free slot → promote from waitlist
    while (state.yes.length < state.maxPlayers && state.waitlist.length > 0) {
      const promoted = state.waitlist.shift();
      state.yes.push(promoted);
    }
  } else if (action === "cancel") {
    // Just freed a spot → promote from waitlist if possible
    while (state.yes.length < state.maxPlayers && state.waitlist.length > 0) {
      const promoted = state.waitlist.shift();
      state.yes.push(promoted);
    }
  } else {
    return interaction.reply({
      content: "❌ Unknown RSVP action.",
      ephemeral: true,
    });
  }

  const updatedEmbed = buildEventEmbed(state);

  await interaction.update({
    embeds: [updatedEmbed],
    components: message.components,
  });

  eventState.set(messageId, state);
}
