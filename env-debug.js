import "dotenv/config";

console.log("DISCORD_BOT_TOKEN present? ", !!process.env.DISCORD_BOT_TOKEN);
console.log("CLIENT_ID present?         ", !!process.env.CLIENT_ID);
console.log("GUILD_ID present?          ", !!process.env.GUILD_ID);
