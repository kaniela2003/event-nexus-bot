import axios from "axios";

// MUST be the root of your Base44 function app:
// Example: https://eventnexus.base44.app
const base = process.env.NEXUS_API_URL;

if (!base) {
  console.warn("NEXUS_API_URL is not set in Railway environment variables.");
}

export async function getNexusStatus() {
  try {
    const res = await axios.get(`${base}/`);
    return {
      ok: true,
      status: res.status,
      data: res.data
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      status: err.response?.status
    };
  }
}

export async function createNexusEvent(payload) {
  const res = await axios.post(`${base}/events`, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return res.data;
}
