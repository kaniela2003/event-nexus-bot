// src/utils/api.js
import axios from "axios";

// Should be: https://eventnexus.base44.app/functions/api
const base = process.env.NEXUS_API_URL;

if (!base) {
  console.warn("NEXUS_API_URL is not set in environment variables.");
}

export async function getNexusStatus() {
  if (!base) {
    return { ok: false, message: "NEXUS_API_URL not set." };
  }

  try {
    const res = await axios.get(base, {
      // Keep a timeout so Discord doesn't hang forever
      timeout: 8000
    });
    return {
      ok: true,
      status: res.status,
      data: res.data
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message,
      status: err.response?.status,
      data: err.response?.data
    };
  }
}

export async function createNexusEvent(payload) {
  if (!base) {
    throw new Error("NEXUS_API_URL not set.");
  }

  const url = `${base.replace(/\/+$/, "")}/events`;
  // => https://eventnexus.base44.app/functions/api/events

  const res = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json"
    },
    timeout: 8000
  });

  return res.data;
}
