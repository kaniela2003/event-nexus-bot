// src/utils/api.js — helper for talking to your Base44 Event Nexus API

import axios from "axios";

const baseUrl = process.env.NEXUS_API_URL;

/**
 * Simple health/status check to see if the Nexus API is reachable.
 * You can change the path later to match your real backend.
 */
export async function getNexusStatus() {
  if (!baseUrl) {
    return {
      ok: false,
      message: "NEXUS_API_URL is not set in environment."
    };
  }

  try {
    // You can adjust this route once your Base44 backend is defined
    const res = await axios.get(baseUrl);
    return {
      ok: true,
      status: res.status,
      data: res.data
    };
  } catch (err) {
    return {
      ok: false,
      message: err.message ?? "Request to Nexus API failed."
    };
  }
}
