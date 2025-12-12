// AUTO-GENERATED to fix Railway crash (missing module).
// Path: src/utils/rsvpEngine.js
// This provides the exports expected by src/commands/rsvp-buttons.js

const _store = new Map(); // eventId -> { meta, rsvp:Set, waitlist:Set, users:Map(userId->{psn,ig}) }

function _getOrCreate(eventId) {
  if (!_store.has(eventId)) {
    _store.set(eventId, {
      meta: { maxPlayers: null, title: null, startTime: null, endTime: null },
      rsvp: new Set(),
      waitlist: new Set(),
      users: new Map()
    });
  }
  return _store.get(eventId);
}

export function normalizeUserId(userId) {
  return String(userId || '').trim();
}

export function ensureEventState(eventId) {
  return _getOrCreate(String(eventId));
}

export function getEventState(eventId) {
  return _getOrCreate(String(eventId));
}

export function setEventMeta(eventId, meta = {}) {
  const s = _getOrCreate(String(eventId));
  s.meta = { ...s.meta, ...meta };
  return s.meta;
}

export function countRsvp(eventId) {
  const s = _getOrCreate(String(eventId));
  return s.rsvp.size;
}

export function countWaitlist(eventId) {
  const s = _getOrCreate(String(eventId));
  return s.waitlist.size;
}

export function listRsvp(eventId) {
  const s = _getOrCreate(String(eventId));
  return Array.from(s.rsvp);
}

export function listWaitlist(eventId) {
  const s = _getOrCreate(String(eventId));
  return Array.from(s.waitlist);
}

export function applyRsvp(eventId, userId, details = {}) {
  const s = _getOrCreate(String(eventId));
  const uid = normalizeUserId(userId);
  if (!uid) return { ok:false, error:'missing_user' };

  // Remove from both first
  s.rsvp.delete(uid);
  s.waitlist.delete(uid);

  // Save details
  const prev = s.users.get(uid) || {};
  s.users.set(uid, { ...prev, ...details });

  const max = s.meta.maxPlayers;
  if (max && Number(max) > 0 && s.rsvp.size >= Number(max)) {
    s.waitlist.add(uid);
    return { ok:true, status:'waitlist' };
  }
  s.rsvp.add(uid);
  return { ok:true, status:'rsvp' };
}

export function cancelRsvp(eventId, userId) {
  const s = _getOrCreate(String(eventId));
  const uid = normalizeUserId(userId);
  const was = s.rsvp.has(uid) ? 'rsvp' : (s.waitlist.has(uid) ? 'waitlist' : 'none');
  s.rsvp.delete(uid);
  s.waitlist.delete(uid);
  moveFromWaitlistIfPossible(eventId);
  return { ok:true, removedFrom: was };
}

export function moveFromWaitlistIfPossible(eventId) {
  const s = _getOrCreate(String(eventId));
  const max = s.meta.maxPlayers;
  if (!max || Number(max) <= 0) return { ok:true, moved:0 };
  let moved = 0;
  while (s.rsvp.size < Number(max) && s.waitlist.size > 0) {
    const next = s.waitlist.values().next().value;
    s.waitlist.delete(next);
    s.rsvp.add(next);
    moved++;
  }
  return { ok:true, moved };
}

export function buildRsvpSummary(eventId) {
  const s = _getOrCreate(String(eventId));
  return {
    rsvpCount: s.rsvp.size,
    waitlistCount: s.waitlist.size,
    maxPlayers: s.meta.maxPlayers || null,
    rsvp: Array.from(s.rsvp),
    waitlist: Array.from(s.waitlist)
  };
}

export const ensureState = null;
export const upsertUser = null;
export const removeUser = null;
export const isIn = null;
export const promoteIfPossible = null;
export const counts = null;
export const formatRoster = null;
