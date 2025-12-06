// src/utils/config.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static config (committed)
const baseConfigPath = path.join(__dirname, "..", "..", "config.json");

// Runtime config (must exist in repo)
const runtimeConfigPath = path.join(__dirname, "..", "..", ".runtime-config.json");

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[EventNexus] Failed to read JSON", filePath, ":", err.message);
    return null;
  }
}

export function getConfig() {
  const base = readJson(baseConfigPath) ?? {};
  const runtime = readJson(runtimeConfigPath) ?? {};

  return { ...base, ...runtime };
}

export function setConfig(partial) {
  const current = getConfig();
  const updated = { ...current, ...partial };

  try {
    fs.writeFileSync(runtimeConfigPath, JSON.stringify(updated, null, 2), "utf8");
    console.log("[EventNexus] Updated runtime config at", runtimeConfigPath);
  } catch (err) {
    console.error("[EventNexus] Failed to write runtime config:", err.message);
  }

  return updated;
}
