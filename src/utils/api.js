import axios from "axios";

const base = process.env.NEXUS_API_URL; 
// Should equal:
// https://eventnexus.base44.app/functions/api

export async function getNexusStatus() {
  try {
    const res = await axios.get(base);
    return {
      ok: true,
      status: res.status,
      data: res.data
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      status: e.response?.status
    };
  }
}

export async function createNexusEvent(payload) {
  const url = `${base}/events`;  
  // → https://eventnexus.base44.app/functions/api/events

  const res = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" }
  });

  return res.data;
}
