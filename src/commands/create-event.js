import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import axios from "axios";
import { registerEvent } from "./rsvp-buttons.js";

const apiBase = process.env.NEXUS_API_URL;        // e.g. https://eventnexus.base44.app/functions/api
const apiKey  = process.env.NEXUS_API_KEY;        // optional if your Base44 function checks it
const defaultChannelId = process.env.DEFAULT_EVENT_CHANNEL;

export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create an Event Nexus event (syncs to app + posts RSVP buttons).")
  .addStringOption((opt) => opt.setName("title").setDescription("Event title").setRequired(true))
  .addStringOption((opt) => opt.setName("start").setDescription("Start time (e.g. 2025-12-20 8:00 PM PST)").setRequired(true))
  .addStringOption((opt) => opt.setName("end").setDescription("End time (optional)").setRequired(false))
  .addStringOption((opt) => opt.setName("description").setDescription("Event description").setRequired(false))
  .addIntegerOption((opt) => opt.setName("maxplayers").setDescription("Max players (optional)").setRequired(false))
  .addAttachmentOption((opt) => opt.setName("image").setDescription("Event image (optional)").setRequired(false));

function toDiscordTs(value, style = "F") {
  if (!value) return String(value || "");
  const d = new Date(String(value).replace(" ", "T"));
  if (!isNaN(d.getTime())) {
    const unix = Math.floor(d.getTime() / 1000);
    return `<t:${unix}:${style}>`;
  }
  return String(value);
}

function buildRsvpRow(eventId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp_join:${eventId}`)
      .setLabel("RSVP ✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rsvp_cancel:${eventId}`)
      .setLabel("Cancel ❌")
      .setStyle(ButtonStyle.Danger)
  );
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("title", true);
  const start = interaction.options.getString("start", true);
  const end = interaction.options.getString("end", false) || null;
  const description = interaction.options.getString("description", false) || null;
  const maxPlayers = interaction.options.getInteger("maxplayers", false) || 30;
  const image = interaction.options.getAttachment("image", false);

  // 1) Sync to app (best-effort; do NOT block Discord posting)
  let appEventId = null;
  let appOk = false;
  let appErr = null;

  if (apiBase) {
    try {
      const payload = {
        title,
        startTime: start,
        endTime: end,
        description,
        maxPlayers,
        imageUrl: image?.url || null,
        guildId: interaction.guildId,
        channelId: defaultChannelId || interaction.channelId,
        createdById: interaction.user.id,
        createdByTag: interaction.user.tag,
      };

      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["api_key"] = apiKey;

      // NOTE: expects POST {NEXUS_API_URL}/events (per your project snapshot)
      const res = await axios.post(`${apiBase}/events`, payload, { headers, timeout: 12000 });

      appEventId =
        res?.data?.id ||
        res?.data?.event?.id ||
        res?.data?.savedEventId ||
        res?.data?.data?.id ||
        null;

      appOk = true;
    } catch (e) {
      appErr = e?.response?.data || e?.message || String(e);
    }
  } else {
    appErr = "Missing NEXUS_API_URL in environment.";
  }

  // 2) Post to Discord
  const eventId = appEventId || `discord-${interaction.id}`;
  registerEvent(eventId, maxPlayers);

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || "No description provided.")
    .addFields(
      { name: "Time", value: end ? `${toDiscordTs(start, "F")} → ${toDiscordTs(end, "t")}` : `${toDiscordTs(start, "F")}`, inline: false },
      { name: `Spots (0/${maxPlayers})`, value: "—", inline: false },
      { name: "Waitlist (0)", value: "—", inline: false }
    )
    .setFooter({ text: "Event Nexus" })
    .setTimestamp();

  if (image?.url) embed.setImage(image.url);

  const row = buildRsvpRow(eventId);

  const channelId = defaultChannelId || interaction.channelId;
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    return await interaction.editReply(`❌ Could not post event: cannot access channel ${channelId}`);
  }

  await channel.send({ embeds: [embed], components: [row] });

  if (appOk) {
    return await interaction.editReply(`✅ Event created + synced to app. (Event ID: ${eventId})`);
  }

  const short = typeof appErr === "string" ? appErr : JSON.stringify(appErr);
  return await interaction.editReply(`⚠️ Event posted to Discord, but app sync FAILED.\nReason: ${String(short).slice(0, 900)}`);
}
