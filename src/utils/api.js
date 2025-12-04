// src/utils/api.js
const axios = require('axios');
const config = require('../../config.json');

// ---------- Supabase REST client ----------
const supabaseRest = axios.create({
  baseURL: `${config.supabaseUrl}/rest/v1`,
  headers: {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

// ---------- RSVP via Edge Function ----------
async function rsvpEvent(eventId, payload) {
  const body = {
    event_id: eventId,
    discord_id: payload.discord_id,
    discord_name: payload.discord_name,
  };

  const res = await axios.post(
    config.supabaseRsvpFunction,
    body,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    }
  );

  return res.data; // expected: { status: "confirmed" | "waitlist" | "blocked", ... }
}

// ---------- Events ----------
async function getEvent(eventId) {
  const res = await supabaseRest.get('/events', {
    params: {
      select: '*',
      id: `eq.${eventId}`,
      limit: 1,
    },
  });

  const rows = res.data;
  if (!rows || rows.length === 0) {
    const error = new Error('Event not found');
    error.code = 'EVENT_NOT_FOUND';
    throw error;
  }

  return rows[0];
}

async function getEventAttendees(eventId) {
  const event = await getEvent(eventId);

  const res = await supabaseRest.get('/attendees', {
    params: {
      select: '*',
      event_id: `eq.${eventId}`,
      order: 'rsvp_at.asc',
    },
  });

  const attendees = res.data || [];

  return {
    event,
    attendees,
  };
}

async function createEvent(event) {
  const res = await supabaseRest.post(
    '/events',
    event,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      params: {
        select: '*',
      },
    }
  );

  const rows = res.data;
  if (!rows || rows.length === 0) {
    throw new Error('Failed to create event');
  }

  return rows[0];
}

// ---------- Guild settings (per server config) ----------
async function getGuildSettings(guildId) {
  const res = await supabaseRest.get('/guild_settings', {
    params: {
      select: '*',
      guild_id: `eq.${guildId}`,
      limit: 1,
    },
  });

  const rows = res.data;
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

async function upsertGuildSettings(settings) {
  const res = await supabaseRest.post(
    '/guild_settings',
    settings,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      params: {
        select: '*',
      },
    }
  );

  const rows = res.data;
  if (!rows || rows.length === 0) {
    throw new Error('Failed to upsert guild_settings');
  }
  return rows[0];
}

// ---------- Exports ----------
module.exports = {
  rsvpEvent,
  getEvent,
  getEventAttendees,
  createEvent,
  getGuildSettings,
  upsertGuildSettings,
};
