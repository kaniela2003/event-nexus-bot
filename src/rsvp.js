import axios from "axios";

async function syncRsvpToBase44(payload) {
  const base = process.env.NEXUS_API_URL;
  const key  = process.env.BASE44_API_KEY || process.env.NEXUS_API_KEY;

  if (!base) return;

  try {
    await axios.post(`${base}/rsvp`, payload, {
      headers: {
        "Content-Type": "application/json",
        ...(key ? { api_key: key } : {})
      },
      timeout: 8000
    });
  } catch (e) {
    // Don’t break Discord if Base44 fails
    console.log("RSVP->Base44 sync failed:", e?.response?.status || "", e?.response?.data || e?.message || String(e));
  }
}

// In-memory RSVP map (eventId -> { going:Set<string> })
const state = new Map();

export function registerEvent(eventId) {
  if (!eventId) return;
  if (!state.has(eventId)) state.set(eventId, { going: new Set() });
}

function parseButton(customId) {
  const id = String(customId || "");
  if (id.startsWith("rsvp_join:")) return { action: "join", eventId: id.split(":")[1] };
  if (id.startsWith("rsvp_cancel:")) return { action: "cancel", eventId: id.split(":")[1] };

  // Also accept rsvp:<action>:<eventId> if you ever switch back
  if (id.startsWith("rsvp:")) {
    const parts = id.split(":");
    return { action: parts[1], eventId: parts[2] };
  }
  return null;
}

export async function handleRsvpButton(i) {
  if (!i.isButton()) return;

  const parsed = parseButton(i.customId);
  if (!parsed?.eventId) return; // not ours

  // ✅ Always ACK fast to prevent "Interaction failed"
  await i.deferUpdate().catch(() => {});

  const { action, eventId } = parsed;
  registerEvent(eventId);

  const userId = i.user.id;
  const s = state.get(eventId);

  if (action === "join" || action === "yes") s.going.add(userId);
  if (action === "cancel") s.going.delete(userId);

  // ✅ Optional: try to sync to Base44 if endpoint exists (won't break Discord if it fails)
  // NOTE: Your snapshot only guarantees /events; RSVP endpoint must exist for this to work.
  const base = process.env.NEXUS_API_URL; // e.g. https://eventnexus.base44.app/functions/api
  const apiKey = process.env.BASE44_API_KEY || process.env.NEXUS_API_KEY;

  if (base) {
    try {
      await axios.post(
        `${base}/rsvp`,
        { eventId, userId, action },
        { headers: apiKey ? { "api_key": apiKey } : {}, timeout: 8000 }
      );
    } catch (e) {
      // Don’t throw — Discord already acknowledged.
      console.log("RSVP sync skipped/failed:", e?.response?.status || "", e?.response?.data || e?.message || String(e));
    }
  }

  // ✅ Update the embed (simple count) if there is an embed
  try {
    const msg = i.message;
    const emb = msg.embeds?.[0];
    if (!emb) return;

    const next = {
      ...emb.toJSON(),
      fields: (emb.fields || []).map(f => {
        if (String(f.name).toLowerCase() === "rsvp") {
          return { ...f, value: String(s.going.size) };
        }
        return f;
      })
    };

    await msg.edit({ embeds: [next] }).catch(() => {});
  } catch {}
}

