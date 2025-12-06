// src/utils/config.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This assumes: C:\Users\kanie\discord-event-bot\config.json
const configPath = path.join(__dirname, "..", "..", "config.json");

export function getConfig() {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("⚠️ config.json missing or unreadable, using empty fallback:", err.message);
    return {};
  }
}

export function setConfig(partial) {
  const existing = getConfig();
  const updated = { ...existing, ...partial };

  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf8");
  console.log("[EventNexus] config.json updated at:", configPath);
  return updated;
}
