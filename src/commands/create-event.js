// src/commands/create-event.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getConfig } from "../utils/config.js";
import { createNexusEvent } from "../utils/api.js";

// In-memory state: messageId -> event state
const eventStates = new Map();

/**
 * Build the embed from current state
 */
function buildEventEmbed(state) {
  const { max, yes, no, waitlist, meta } = state;
  const { title, time, description, hostTag, backendId } = meta;

  const yesList =
    yes.size > 0 ? [...yes].map((id) => `<@${id}>`).join(", ") : "—";
  const waitListText =
    waitlist.size > 0 ? [...waitlist].map((id) => `<@${id}>`).join(", ") : "—";
  const noList =
    no.size > 0 ? [...no].map((id) => `<@${id}>`).join(", ") : "—";

  let desc =
    `**Time:** ${time}\n` +
    `**Max players:** ${max}\n` +
    `**Host:** ${hostTag}\n\n` +
    `**Yes (${yes.size}/${max}):** ${yesList}\n` +
    `**Waitlist (${waitlist.size}):** ${waitListText}\n` +
    `**No (${no.size}):** ${noList}`;

  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${title}`)
    .setDescription(desc)
    .setColor(0x00aeff)
    .setTimestamp(new Date());

  const fields = [];

  if (description) {
    fields.push({
      name: "Description",
      value: description,
    });
  }

  fields.push({
    name: "Synced to App",
    value: backendId ? `✅ ID: \`${backendId}\`` : "⚠️ Not synced",
  });

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

/**
 * Build the RSVP buttons
 */
function buildEventButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("event_yes")
      .setLabel("Yes")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("event_no")
      .setLabel("No")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("event_cancel")
      .setLabel("Cancel RSVP")
      .setStyle(ButtonStyle.Secondary)
  );
}

export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create a new GTA Online event with RSVP + waitlist.")
  .addStringOption((opt) =>
    opt.setName("title").setDescription("Event title").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("time")
      .setDescription("Event time (e.g. 2025-12-05 20:00 PST)")
      .setRequired(true)
  )
  // required BEFORE any optional
  .addIntegerOption((opt) =>
    opt
      .setName("capacity")
      .setDescription("Max players for this event")
      .setRequired(true)
      .setMinValue(1)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription("Short description of the event")
      .setRequired(false)
  );

/**
 * Slash command: /createevent
 */
export async function execute(interaction) {
  const { options, guild } = interaction;

  const title = options.getString("title", true);
  const time = options.getString("time", true);
  const description = options.getString("description") || "";
  const capacity = options.getInteger("capacity", true);

  // Pick channel: saved event channel or current
  let targetChannel = interaction.channel;
  try {
    const cfg = getConfig();
    if (cfg?.eventChannelId && guild) {
      const maybeChannel = guild.channels.cache.get(cfg.eventChannelId);
      if (maybeChannel) {
        targetChannel = maybeChannel;
      }
    }
  } catch (err) {
    console.warn("⚠️ Failed to read config for event channel:", err.message);
  }

  await interaction.deferReply({ ephemeral: true });

  // Sync to Base44 via shared helper
  let backendId = null;

  try {
    const payload = {
      title,
      time,
      description,
      maxPlayers: capacity,
      guildId: guild?.id ?? null,
      channelId: targetChannel.id,
      createdBy: interaction.user.id,
    };

    const event = await createNexusEvent(payload);
    backendId = event?.id ?? null;
    console.log("✅ Synced event to Nexus:", event);
  } catch (err) {
    const detail =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      String(err);
    console.error("❌ Failed to sync event to Nexus:", detail);
  }

  const state = {
    max: capacity,
    yes: new Set(),
    no: new Set(),
    waitlist: new Set(),
    meta: {
      title,
      time,
      description,
      hostTag: interaction.user.tag,
      createdById: interaction.user.id,
      backendId,
    },
  };

  const embed = buildEventEmbed(state);
  const buttons = buildEventButtons();

  const message = await targetChannel.send({
    embeds: [embed],
    components: [buttons],
  });

  // Save state by message ID
  eventStates.set(message.id, state);

  await interaction.editReply({
    content: `✅ Event created in <#${message.channel.id}> with capacity **${capacity}**.`,
  });
}

/**
 * Handle button interactions for Yes / No / Cancel RSVP
 * Hook this from index.js:
 *   import { handleEventButton } from "./commands/create-event.js";
 *   if (interaction.isButton()) await handleEventButton(interaction);
 */
export async function handleEventButton(interaction) {
  if (!interaction.isButton()) return;

  const messageId = interaction.message.id;
  const state = eventStates.get(messageId);

  if (!state) {
    await interaction.reply({
      content: "⚠️ This event is no longer active in memory.",
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const customId = interaction.customId;
  const { max, yes, no, waitlist } = state;

  let replyText = "";

  const removeFromAll = () => {
    yes.delete(userId);
    no.delete(userId);
    waitlist.delete(userId);
  };

  const promoteFromWaitlist = () => {
    if (yes.size >= max || waitlist.size === 0) return null;
    const nextId = waitlist.values().next().value;
    if (!nextId) return null;
    waitlist.delete(nextId);
    yes.add(nextId);
    return nextId;
  };

  if (customId === "event_yes") {
    if (yes.has(userId)) {
      replyText = "✅ You’re already marked as **Yes** for this event.";
    } else {
      // Remove from "no" or waitlist if previously there
      no.delete(userId);
      waitlist.delete(userId);

      if (yes.size < max) {
        yes.add(userId);
        replyText = "✅ You’re in for this event.";
      } else {
        waitlist.add(userId);
        replyText =
          "⏳ Event is full — you’ve been added to the **waitlist**.";
      }
    }
  } else if (customId === "event_no") {
    const wasInYes = yes.has(userId);
    const wasInWait = waitlist.has(userId);

    removeFromAll();
    no.add(userId);

    let promoted = null;
    if (wasInYes) {
      promoted = promoteFromWaitlist();
    }

    if (promoted) {
      replyText = `❌ You’re marked as **No**. <@${promoted}> was moved from waitlist into the event.`;
    } else if (wasInYes || wasInWait) {
      replyText = "❌ You’re marked as **No** and removed from the event.";
    } else {
      replyText = "❌ You’re marked as **No** for this event.";
    }
  } else if (customId === "event_cancel") {
    const wasInYes = yes.has(userId);
    const wasInWait = waitlist.has(userId);

    if (!wasInYes && !wasInWait) {
      replyText = "ℹ️ You don’t have an active RSVP to cancel.";
    } else {
      removeFromAll();
      const promoted = promoteFromWaitlist();
      if (promoted) {
        replyText = `🔁 Your RSVP was canceled. <@${promoted}> was moved from waitlist into the event.`;
      } else {
        replyText = "🔁 Your RSVP was canceled and your spot is now open.";
      }
    }
  } else {
    // Not one of our buttons
    return;
  }

  // Rebuild embed and update message
  const updatedEmbed = buildEventEmbed(state);
  const buttons = buildEventButtons();

  await interaction.message.edit({
    embeds: [updatedEmbed],
    components: [buttons],
  });

  await interaction.reply({
    content: replyText,
    ephemeral: true,
  });
}
