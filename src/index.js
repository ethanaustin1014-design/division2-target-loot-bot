require("dotenv").config();

const cron = require("node-cron");
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas } = require("@napi-rs/canvas");

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const timezone = process.env.TIME_ZONE || "Europe/London";
const cronExpression = process.env.POST_CRON || "2 8 * * *";
const apiUrl = process.env.PROTOTRACK_API_URL;
const sourceUrl = process.env.PROTOTRACK_SOURCE_URL || "https://prototrack.gg/";
const configuredImageUrl = process.env.PROTOTRACK_IMAGE_URL;

if (!token || !channelId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CHANNEL_ID. Copy .env.example to .env and fill them in.");
  process.exit(1);
}
if (!cron.validate(cronExpression)) {
  console.error(`Invalid POST_CRON expression: ${cronExpression}`);
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function ukDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}

async function getRotation() {
  if (!apiUrl) {
    throw new Error("PROTOTRACK_API_URL is not configured. Obtain an approved API/feed URL from ProtoTrack first.");
  }

  const response = await fetch(apiUrl, {
    headers: { "Accept": "application/json", "User-Agent": "Division2TargetLootBot/1.0 (Discord community bot)" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`ProtoTrack feed returned HTTP ${response.status}`);

  const data = await response.json();

  // Expected approved-feed format:
  // {
  //   "date": "2026-10-29",
  //   "missions": [{"name":"Coney Island Ballpark","loot":"Ongoing Directive"}, ...],
  //   "vendorCaches": [{"name":"Prototype Gear Cache","loot":"Kneepads"}, ...],
  //   "imageUrl": "https://..."
  // }
  if (!data || !Array.isArray(data.missions) || data.missions.length === 0) {
    throw new Error("Feed schema invalid: expected a non-empty missions array. No post sent.");
  }
  for (const item of data.missions) {
    if (!item || typeof item.name !== "string" || typeof item.loot !== "string") {
      throw new Error("Feed contains a mission without string name/loot fields. No post sent.");
    }
  }
  if (data.vendorCaches !== undefined && !Array.isArray(data.vendorCaches)) {
    throw new Error("Feed schema invalid: vendorCaches must be an array.");
  }
  return data;
}

async function makeLootImage(rotation) {
  const width = 1200;
  const rowHeight = 108;
  const titleHeight = 190;
  const vendorCount = Array.isArray(rotation.vendorCaches) ? rotation.vendorCaches.length : 0;
  const height = Math.max(500, titleHeight + (rotation.missions.length + vendorCount) * rowHeight + 95);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Dark, game-inspired original graphic; not an official Ubisoft graphic.
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#111923");
  bg.addColorStop(1, "#202d38");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#e7a83e";
  ctx.fillRect(0, 0, width, 12);
  ctx.fillStyle = "#f4f6f8";
  ctx.font = "bold 48px Arial";
  ctx.fillText("THE DIVISION 2", 54, 76);
  ctx.font = "bold 32px Arial";
  ctx.fillStyle = "#e7a83e";
  ctx.fillText("DAILY TARGET LOOT", 54, 126);
  ctx.font = "24px Arial";
  ctx.fillStyle = "#c7d0d8";
  ctx.fillText(`Rotation date: ${rotation.date || ukDate()}`, 54, 164);

  let y = titleHeight;
  function drawRow(label, loot, index) {
    ctx.fillStyle = index % 2 === 0 ? "#263542" : "#1c2934";
    ctx.fillRect(42, y, width - 84, rowHeight - 12);
    ctx.fillStyle = "#e7a83e";
    ctx.fillRect(42, y, 7, rowHeight - 12);
    ctx.fillStyle = "#f5f7f9";
    ctx.font = "bold 25px Arial";
    ctx.fillText(String(label).slice(0, 54), 68, y + 37);
    ctx.fillStyle = "#cbd5df";
    ctx.font = "23px Arial";
    ctx.fillText(String(loot).slice(0, 62), 68, y + 72);
    y += rowHeight;
  }

  rotation.missions.forEach((m, i) => drawRow(m.name, `Target loot: ${m.loot}`, i));

  if (vendorCount) {
    ctx.fillStyle = "#e7a83e";
    ctx.font = "bold 27px Arial";
    ctx.fillText("VENDOR CACHES", 54, y + 12);
    y += 30;
    rotation.vendorCaches.forEach((v, i) => drawRow(v.name || "Vendor Cache", `Target loot: ${v.loot}`, i));
  }

  ctx.fillStyle = "#9eabb7";
  ctx.font = "19px Arial";
  ctx.fillText("Data: ProtoTrack.gg  •  Check the source for the latest rotation", 54, height - 38);
  return canvas.toBuffer("image/png");
}

async function postRotation() {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      throw new Error("Configured channel was not found or is not a text channel.");
    }

    const rotation = await getRotation();
    const date = rotation.date || ukDate();
    const missionLines = rotation.missions.map(m => `• **${m.name}** — ${m.loot}`).join("\n");
    const vendorLines = Array.isArray(rotation.vendorCaches) && rotation.vendorCaches.length
      ? "\n\n**Vendor caches**\n" + rotation.vendorCaches.map(v => `• **${v.name || "Vendor Cache"}** — ${v.loot}`).join("\n")
      : "";

    const embed = new EmbedBuilder()
      .setColor(0xe7a83e)
      .setTitle(`🎯 Daily Target Loot — ${date}`)
      .setURL(sourceUrl)
      .setDescription(`${missionLines}${vendorLines}`)
      .setFooter({ text: "Data: ProtoTrack.gg • Verify the current rotation at the source" })
      .setTimestamp(new Date());

    let imageUrl = rotation.imageUrl || configuredImageUrl;
    const files = [];
    if (imageUrl && /^https:\/\/\S+$/i.test(imageUrl)) {
      embed.setImage(imageUrl);
    } else {
      const png = await makeLootImage(rotation);
      files.push(new AttachmentBuilder(png, { name: "daily-target-loot.png" }));
      embed.setImage("attachment://daily-target-loot.png");
    }

    await channel.send({
      content: `🎯 **The Division 2 — Daily Target Loot** | ${date}`,
      embeds: [embed],
      files
    });
    console.log(`Posted target loot for ${date} to channel ${channelId}.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Target loot post failed:`, error.message);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Daily schedule: ${cronExpression} (${timezone})`);
  console.log("No post is sent until an approved ProtoTrack JSON/API feed is configured.");

  cron.schedule(cronExpression, postRotation, { timezone });
  // Optional manual smoke test: set RUN_TEST_POST=true in .env before starting.
  if (process.env.RUN_TEST_POST === "true") {
    postRotation().catch(err => console.error("Test post failed:", err));
  }
});

client.login(token).catch(error => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
