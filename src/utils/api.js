import axios from "axios";

const base = process.env.NEXUS_API_URL;

if (!base) {
  console.warn("NEXUS_API_URL is not set.");
}

export async function getNexusStatus() {
  if (!base) {
    return { ok: false, message: "NEXUS_API_URL not set." };
  }

  try {
    const res = await axios.get(base);
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

  const res = await axios.post(`${base}/events`, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return res.data;
}
