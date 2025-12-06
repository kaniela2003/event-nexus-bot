// src/utils/config.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "os";

const __filename = fileURLToPath(__dirname + "/dummy").replace(/dummy$/, "");
const __dirname_resolved = path.dirname(__filename);

// Base config shipped with the app (read-only in production)
const rootConfigPath = path.join(__dirname_resolved, "..", "..", "config.json");
// Runtime override (safe to write, especially on Railway)
const runtimeConfigPath = path.join(os.tmpdir(), "event-nexus-config.json");

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[EventNexus] Failed to read JSON from", p, ":", err.message);
    return null;
  }
}

export function getConfig() {
  // 1) Prefer runtime overrides if present
  const runtime = readJson(runtimeConfigPath);
  if (runtime) {
    console.log("[EventNexus] Using runtime config at", runtimeConfigPath);
    return runtime;
  }

  // 2) Fallback to root config.json
  const base = readJson(rootConfigPath);
  if (base) {
    console.log("[EventNexus] Using base config at", rootConfigPath);
    return base;
  }

  console.warn("[EventNexus] No config.json found. Using empty config.");
  return {};
}

export function setConfig(partial) {
  const existing = getConfig();
  const updated = { ...existing, ...partial };

  try {
    const dir = path.dirname(runtimeConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(runtimeConfigPath, JSON.stringify(updated, null, 2), "utf8");
    console.log("[EventNexus] Runtime config updated at", runtimeConfigPath);
  } catch (err) {
    console.error("[EventNexus] Failed to write runtime config:", err);
    // Don't throw – let the bot continue running
  }

  return updated;
}
