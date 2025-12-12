import axios from "axios";

const apiUrl = process.env.NEXUS_API_URL;
const apiKey = process.env.NEXUS_API_KEY;

export async function postRsvpToApp(payload) {
  if (!apiUrl || !apiKey) {
    console.log("⚠️ Skipping RSVP -> App sync (missing NEXUS_API_URL or NEXUS_API_KEY)");
    return { ok: false, skipped: true };
  }

  try {
    // Base44 expects api_key header (per your API info screen)
    const res = await axios.post(apiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "api_key": apiKey,
      },
      timeout: 10000,
    });

    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    const status = err?.response?.status || null;
    const data = err?.response?.data || err?.message || String(err);
    console.log("❌ RSVP -> App sync failed:", status, data);
    return { ok: false, status, data };
  }
}
