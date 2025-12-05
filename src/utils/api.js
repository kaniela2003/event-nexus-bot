// src/utils/api.js
import axios from "axios";

export async function getNexusStatus() {
  const base = process.env.NEXUS_API_URL;
  if (!base) return { ok: false, message: "NEXUS_API_URL not set." };

  try {
    const res = await axios.get(base);
    return { ok: true, status: res.status, data: res.data };
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
  const base = process.env.NEXUS_API_URL;
  if (!base) throw new Error("NEXUS_API_URL not set.");

  const res = await axios.post(`${base}/events`, payload, {
    headers: {
      "Content-Type": "application/json",
      // If your Base44 function checks an API key, uncomment this and set BASE44_API_KEY in Railway:
      // "x-api-key": process.env.BASE44_API_KEY,
    },
  });

  return res.data;
}
