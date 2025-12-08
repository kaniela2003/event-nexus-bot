// src/utils/api.js
import axios from "axios";

// NEXUS_API_URL should be the ROOT of your function, e.g.:
// NEXUS_API_URL = https://eventnexus.base44.app/functions/api
const base = process.env.NEXUS_API_URL;
const apiKey = process.env.BASE44_API_KEY || process.env.NEXUS_API_KEY || null;

if (!base) {
  console.warn("⚠️ NEXUS_API_URL is not set in environment variables.");
}

/**
 * Health check for /nexus command.
 * - Calls GET NEXUS_API_URL (root)
 * - Expects any JSON; we just care about status and body.
 */
export async function getNexusStatus() {
  if (!base) {
    return { ok: false, message: "NEXUS_API_URL not set." };
  }

  try {
    const res = await axios.get(base, {
      timeout: 8000,
      headers: {
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
    });

    return {
      ok: true,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;

    let message = err.message || "Request failed";
    if (status) message += ` | status=${status}`;
    if (data) {
      try {
        message += ` | body=${JSON.stringify(data)}`;
      } catch {
        // ignore stringify issues
      }
    }

    return {
      ok: false,
      status,
      message,
      data,
    };
  }
}

/**
 * Create an event in the Nexus backend.
 * - POSTs to `${base}/events`
 */
export async function createNexusEvent(payload) {
  if (!base) {
    throw new Error("NEXUS_API_URL not set.");
  }

  const url = base.endsWith("/") ? `${base}events` : `${base}/events`;

  const res = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    timeout: 8000,
  });

  return res.data;
}
