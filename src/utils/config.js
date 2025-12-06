// src/utils/config.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// We read/write this file: <project-root>/config.json
const configPath = path.join(__dirname, "..", "..", "config.json");

// Simple in-memory cache so config survives even if disk writes fail
let cachedConfig = null;

function loadFromDisk() {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      "[EventNexus] config.json missing or unreadable, using empty config:",
      err.message
    );
    return {};
  }
}

export function getConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  cachedConfig = loadFromDisk();
  return cachedConfig;
}

export function setConfig(partial) {
  const current = getConfig();
  const updated = { ...current, ...partial };
  cachedConfig = updated;

  try {
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf8");
    console.log("[EventNexus] config.json updated at", configPath);
  } catch (err) {
    console.error(
      "[EventNexus] Failed to write config.json (using in-memory only):",
      err.message
    );
    // We still keep cachedConfig in memory so it works until restart
  }

  return updated;
}
