import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import axios from "axios";

const apiUrlRaw = process.env.NEXUS_API_URL;   // ex: https://eventnexus.base44.app/functions/api
const apiKey = process.env.NEXUS_API_KEY;      // Base44 api_key value (keep as-is, no new vars)
const defaultChannelId = process.env.DEFAULT_EVENT_CHANNEL;

function normalizeEventsUrl(base) {
  if (!base) return null;
  const b = String(base).replace(/\/+$/,"");
  return b.endsWith("/events") ? b : `${b}/events`;
}

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
    new ButtonBuilder().setCustomId(`rsvp_join:${eventId}`).setLabel("RSVP ✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rsvp_cancel:${eventId}`).setLabel("Cancel ❌").setStyle(ButtonStyle.Danger)
  );
}

export const data = new SlashCommandBuilder()
  .setName("createevent")
  .setDescription("Create an Event Nexus event (syncs to app + posts RSVP buttons).")
  .addStringOption(opt => opt.setName("title").setDescription("Event title").setRequired(true))
  .addStringOption(opt => opt.setName("start").setDescription("Start time (e.g. 2025-12-20 8:00 PM PST)").setRequired(true))
  .addStringOption(opt => opt.setName("end").setDescription("End time (e.g. 2025-12-20 10:00 PM PST)").setRequired(false))
  .addStringOption(opt => opt.setName("description").setDescription("Event description").setRequired(false))
  .addIntegerOption(opt => opt.setName("maxplayers").setDescription("Max players (optional)").setRequired(false))
  .addAttachmentOption(opt => opt.setName("image").setDescription("Event image (optional)").setRequired(false));

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const title = interaction.options.getString("title", true);
  const start = interaction.options.getString("start", true);
  const end = interaction.options.getString("end", false) || null;
  const description = interaction.options.getString("description", false) || null;
  const maxPlayers = interaction.options.getInteger("maxplayers", false);
  const image = interaction.options.getAttachment("image", false);

  const eventsUrl = normalizeEventsUrl(apiUrlRaw);

  // 1) Sync to app FIRST (best-effort)
  let appEventId = null;
  let appOk = false;
  let appErr = null;

  if (!eventsUrl || !apiKey) {
    appErr = "Missing NEXUS_API_URL or NEXUS_API_KEY in environment.";
  } else {
    try {
      const payload = {
        title,
        time: start,                 // backend expects "time" per snapshot
        description: description ?? null,
        maxPlayers: maxPlayers ?? null,
        guildId: interaction.guildId,
        channelId: defaultChannelId || interaction.channelId,
        createdBy: interaction.user?.tag || interaction.user?.id,
        imageUrl: image?.url || null
      };

      const res = await axios.post(eventsUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          "api_key": apiKey
        },
        timeout: 12000
      });

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
  }

  // 2) Post in Discord with RSVP buttons using appEventId (fallback to a discord-based id)
  const eventId = appEventId || `discord-${interaction.id}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || "No description provided.")
    .addFields(
      { name: "Time", value: end ? `${toDiscordTs(start,"F")} → ${toDiscordTs(end,"t")}` : `${toDiscordTs(start,"F")}`, inline: false },
      { name: "RSVP", value: maxPlayers ? `0/${maxPlayers}` : "0", inline: true },
      { name: "Waitlist", value: "0", inline: true }
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
  return await interaction.editReply(`⚠️ Event posted to Discord, but app sync FAILED.\nReason: ${JSON.stringify(appErr).slice(0, 900)}`);
}
