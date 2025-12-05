// src/utils/api.js
import axios from "axios";

const base = process.env.NEXUS_API_URL;
const apiKey = process.env.BASE44_API_KEY;

if (!base) {
  console.warn("NEXUS_API_URL is not set in environment variables.");
}
if (!apiKey) {
  console.warn("BASE44_API_KEY is not set in environment variables.");
}

// Simple status check – pulls 1 Event just to verify connectivity
export async function getNexusStatus() {
  if (!base || !apiKey) {
    return { ok: false, message: "NEXUS_API_URL or BASE44_API_KEY not set." };
  }

  try {
    const res = await axios.get(`${base}/entities/Event`, {
      headers: {
        api_key: apiKey,
        "Content-Type": "application/json",
      },
      params: {
        limit: 1,
      },
    });

    return {
      ok: true,
      status: res.status,
      count: Array.isArray(res.data) ? res.data.length : 0,
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

// Helper to create an Event via Entities API
export async function createNexusEvent(payload) {
  if (!base || !apiKey) {
    throw new Error("NEXUS_API_URL or BASE44_API_KEY not set.");
  }

  const res = await axios.post(`${base}/entities/Event`, payload, {
    headers: {
      api_key: apiKey,
      "Content-Type": "application/json",
    },
  });

  return res.data;
}
