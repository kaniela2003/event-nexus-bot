// src/utils/api.js
import axios from "axios";

// Prefer NEXUS_API_URL (snapshot standard), but fall back to BASE44_API_URL if set
const base =
  process.env.NEXUS_API_URL ||
  process.env.BASE44_API_URL ||
  "";

if (!base) {
  console.warn("NEXUS_API_URL or BASE44_API_URL is not set in environment variables.");
}

// GET backend root (used by /nexus)
export async function getNexusStatus() {
  if (!base) {
    return { ok: false, message: "NEXUS_API_URL or BASE44_API_URL not set." };
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

// POST /events (used by /createevent)
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
    throw new Error("NEXUS_API_URL or BASE44_API_URL not set.");
  }

  const url = `${base.replace(/\/+$/, "")}/events`;

  const payload = {
    title,
    time,
    description: description ?? "",
    maxPlayers: maxPlayers ?? null,
    guildId,
    channelId,
    createdBy,
  };

  const res = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      // Uncomment if your Base44 function requires an API key:
      // "x-api-key": process.env.BASE44_API_KEY,
    },
  });

  return res.data;
}
