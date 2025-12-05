// src/utils/api.js
import axios from "axios";

const base = process.env.NEXUS_API_URL;

if (!base) {
  console.warn("NEXUS_API_URL is not set in environment variables.");
}

// GET /functions/api  → used by /nexus to check health
export async function getNexusStatus() {
  if (!base) {
    return { ok: false, message: "NEXUS_API_URL not set." };
  }

  try {
    const res = await axios.get(base);
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

// POST /functions/api/events  → used by /createevent
export async function createNexusEvent({
  title,
  time,
  description,
  maxPlayers,
  guildId,
  channelId,
  createdBy,
}) {
  if (!base) {
    throw new Error("NEXUS_API_URL not set.");
  }

  const payload = {
    title,
    time,
    description: description ?? "",
    maxPlayers: maxPlayers ?? null,
    guildId,
    channelId,
    createdBy,
  };

  const res = await axios.post(`${base}/events`, payload, {
    headers: {
      "Content-Type": "application/json",
      // If your Base44 function checks for an API key, uncomment this line
      // and make sure BASE44_API_KEY is set in Railway:
      // "x-api-key": process.env.BASE44_API_KEY,
    },
  });

  return res.data;
}
