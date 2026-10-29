# Division 2 Target Loot Discord Bot

A Node.js + Discord.js bot skeleton for a daily target-loot post with an image and text summary.

## Important: ProtoTrack feed permission is required

ProtoTrack's Target Loot Analytics page says community websites, bots and social accounts can request free permission to reuse its data, but asks you to contact them first to agree on the data and publication channels. Approved uses must visibly credit `Data: ProtoTrack.gg` and link to `https://prototrack.gg/` where links are supported. Donations are optional.

Before using the bot, contact ProtoTrack through its official site and ask for an approved API/feed URL and the permitted fields/image assets. Do not assume that a page's internal JSON file or undocumented endpoint is an approved public API.

Analytics / contact information:
https://prototrack.gg/target-loot/target-loot-analytics.php

Target Loot page:
https://prototrack.gg/target-loot/target-loot.php

## Requirements

- Node.js 20 or newer
- A Discord application/bot token
- A Discord text channel ID
- An approved ProtoTrack JSON/API feed

## Setup

1. Upload/extract this project on a host that supports persistent Node.js processes.
2. Copy `.env.example` to `.env`.
3. Fill in `DISCORD_TOKEN` and `DISCORD_CHANNEL_ID`.
4. Set `PROTOTRACK_API_URL` to the endpoint ProtoTrack approves for your use.
5. Install dependencies with `npm install`.
6. Start it with `npm start`.
7. Check logs for `Logged in as ...` and `Daily schedule: 2 8 * * * (Europe/London)`.

The schedule uses `Europe/London`, so it follows the UK's GMT/BST daylight-saving changes. The host process must remain running for the scheduled task to fire.

## Expected API response schema

The adapter currently expects JSON shaped like:

```json
{
  "date": "2026-10-29",
  "missions": [
    { "name": "Coney Island Ballpark", "loot": "Ongoing Directive" },
    { "name": "Coney Island Amusement Park", "loot": "Belstone Armory" }
  ],
  "vendorCaches": [
    { "name": "Prototype Gear Cache", "loot": "Kneepads" },
    { "name": "Prototype Weapon Cache", "loot": "Pistols" }
  ],
  "imageUrl": "https://example.com/approved-image.png"
}
```

This is an example schema for integration, not a real ProtoTrack API response. Change `getRotation()` only after you receive the actual approved API documentation. If no image URL is supplied, the bot generates an original PNG card from the JSON data.

## Discord permissions

Grant the bot in the dedicated channel:
- View Channel
- Send Messages
- Embed Links
- Attach Files

No Administrator permission is needed.

## Testing

- First set `PROTOTRACK_API_URL` to your approved test feed.
- Set `RUN_TEST_POST=true` in `.env` to send a test post on startup, then remove or set it to `false` after checking the result.
- Check host logs if no post appears.
- The bot deliberately refuses to post if the feed URL is missing or the response has no valid missions.

## Hosting notes

Choose a host with an always-on Node.js service/worker and persistent process support. Some free tiers sleep or stop background workers, which can miss the 08:02 schedule. Set the host's startup command to `npm start`.
