import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";

// Load all commands from /src/commands folder
export async function loadCommands(client) {
  const commandsPath = path.resolve("src/commands");
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  client.commands = new Map();

  for (const file of files) {
    const command = await import(`./commands/${file}`);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    }
  }

  console.log(`⚡ Loaded ${client.commands.size} commands.`);
}

// Register slash commands globally
export async function registerGlobalCommands(clientId, token) {
  const commandsPath = path.resolve("src/commands");
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  const body = [];

  for (const file of files) {
    const command = await import(`./commands/${file}`);
    if (command.data) body.push(command.data.toJSON());
  }

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), { body });

  console.log("✅ Global slash commands synced to Discord.");
}
