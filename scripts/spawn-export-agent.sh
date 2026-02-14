#!/bin/bash

# This script is called by the web app to spawn a Propstream export sub-agent
# It triggers the spawn by sending a message to Spike via Telegram API

TODAY=$(date +%Y-%m-%d)
OUTPUT_PATH="/home/ubuntu/clawd/propstream-exports/$TODAY/Vol-Flip-New.csv"

# Update status file immediately
cat > /tmp/propstream-export-status.json << EOF
{
  "running": true,
  "timestamp": $(date +%s)000,
  "message": "Spawn requested, waiting for sub-agent..."
}
EOF

# Send spawn request to Spike via Telegram
# (Spike will pick this up and spawn the sub-agent)
BOT_TOKEN="8588287579:AAHy5p5BWlZNMVE2jMgcc7Pz-Johi7iKnik"
CHAT_ID="8175907210"

MESSAGE="🤖 **SPAWN REQUEST FROM WEB APP**

Please spawn a sub-agent to export Propstream \"Vol Flip - New\" list.

Task:
- Login to Propstream
- Handle overlays
- Export \"Vol Flip - New\" to: $OUTPUT_PATH
- Update /tmp/propstream-export-status.json when done

Use model: sonnet
Label: propstream-export-webapp"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}" \
  -d "parse_mode=Markdown" > /dev/null

echo '{"success":true,"message":"Spawn request sent to Spike"}'
