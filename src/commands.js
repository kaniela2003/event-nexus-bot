// src/commands.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, "commands");

// Load every .js file in src/commands
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const commandModule = await import(`./commands/${file}`);

  const cmd = commandModule.default ?? commandModule;

  if (cmd?.data && typeof cmd.data.toJSON === "function") {
    commands.push(cmd.data.toJSON());
  } else {
    console.warn(`⚠️ Command file ${file} is missing "data" or toJSON()`);
  }
}

export default commands;
