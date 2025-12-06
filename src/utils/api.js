// src/utils/api.js
import axios from "axios";

// This must be the FULL events endpoint, e.g.:
// NEXUS_API_URL = https://eventnexus.base44.app/functions/api/events
const base = process.env.NEXUS_API_URL;

if (!base) {
  console.warn("NEXUS_API_URL is not set in environment variables.");
}

export async function getNexusStatus() {
  if (!base) {
    return { ok: false, message: "NEXUS_API_URL not set." };
  }

  try {
    // Health check: simple GET to the same endpoint
    const res = await axios.get(base, {
      timeout: 8000,
    });

    return {
      ok: true,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    };
  }
}

export async function createNexusEvent(payload) {
  if (!base) {
    throw new Error("NEXUS_API_URL not set.");
  }

  // POST directly to the same endpoint
  const res = await axios.post(base, payload, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 8000,
  });

  return res.data;
}
